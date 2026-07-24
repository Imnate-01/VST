import type { CertificateStatus } from "@prisma/client";
import {
  upsertMeasurement,
  upsertTestReadings,
  upsertVerification,
} from "@/server/actions/measurements";
import { signCertificate } from "@/server/actions/signatures";
import {
  aggregateCertificateStatus,
  calculateMeasurementStatus,
  calculateTestReadings,
  decimalToStringOrNull,
  normalizeTestParams,
  testTarget,
} from "@/shared/domain/measurement-status";
import { hasCompleteVerificationRows } from "@/server/domain/certificate-completeness";
import { getCertificateConfig } from "@/lib/certificates";
import { enqueueOp, getDb, type LocalCertState } from "@/lib/offline/db";
import type {
  OfflineCertificate,
  OfflineMeasurement,
  OfflineSignature,
} from "@/lib/offline/bundle-types";
import type {
  UpsertMeasurementInput,
  UpsertTestReadingsInput,
  UpsertVerificationInput,
} from "@/lib/validations/measurements";

export type SaveResult = {
  ok: boolean;
  certificateStatus?: CertificateStatus;
  message?: string;
};

type ToleranceMap = Map<string, { value: string; isPercent: boolean }>;

async function loadCertificate(certificateId: string) {
  const cert = await getDb().certificates.get(certificateId);
  if (!cert) {
    throw new Error("offline_certificate_missing");
  }
  return cert;
}

function toleranceMapFor(deviceSelections: {
  id: string;
  toleranceValueSnapshot: string;
  toleranceIsPercentSnapshot: boolean;
}[]): ToleranceMap {
  return new Map(
    deviceSelections.map((selection) => [
      selection.id,
      {
        value: selection.toleranceValueSnapshot,
        isPercent: selection.toleranceIsPercentSnapshot,
      },
    ])
  );
}

/** Persiste la captura local, revoca la firma (como el servidor) y encola. */
async function commitLocal(params: {
  reportId: string;
  certificateId: string;
  type: "upsertMeasurement" | "upsertTestReadings" | "upsertVerification";
  payload: unknown;
  updateData: (data: OfflineCertificate) => void;
  local: LocalCertState;
}): Promise<void> {
  const db = getDb();
  await db.transaction("rw", db.certificates, db.reports, db.outbox, async () => {
    const cert = await db.certificates.get(params.certificateId);
    if (!cert) throw new Error("offline_certificate_missing");

    params.updateData(cert.data);
    cert.data.overallStatus = params.local.overallStatus;
    cert.local = params.local;
    // Una firma vale sobre el contenido firmado: si cambia, se revoca.
    cert.signature = null;
    cert.syncState = "dirty";
    cert.updatedAt = Date.now();
    await db.certificates.put(cert);

    const report = await db.reports.get(params.reportId);
    if (report) {
      report.syncState = "dirty";
      await db.reports.put(report);
    }

    await enqueueOp({
      reportId: params.reportId,
      certificateId: params.certificateId,
      type: params.type,
      payload: params.payload,
    });
  });
}

// ============ Mediciones por puntos ============

export async function saveMeasurement(
  input: UpsertMeasurementInput,
  online: boolean
): Promise<SaveResult> {
  if (online) {
    return (await upsertMeasurement(input)) ?? { ok: false };
  }

  const cert = await loadCertificate(input.certificateId);
  const tolerances = toleranceMapFor(cert.data.deviceSelections);

  const measurements: OfflineMeasurement[] = [];
  const rowStatus: LocalCertState["rowStatus"] = {};

  for (const measurementInput of input.measurements) {
    const tolerance = tolerances.get(measurementInput.deviceSelectionId);
    if (!tolerance) return { ok: false, message: "offline_device_missing" };

    const calculated = calculateMeasurementStatus({
      certificateType: input.certificateType,
      input: measurementInput,
      toleranceValue: tolerance.value,
      toleranceIsPercent: tolerance.isPercent,
    });

    measurements.push({
      deviceSelectionId: measurementInput.deviceSelectionId,
      notes: measurementInput.notes?.trim() || null,
      correctionMethod: measurementInput.correctionMethod?.trim() || null,
      requiredAdjustment: calculated.requiredAdjustment,
      status: calculated.status,
      statusReason: calculated.statusReason,
      points: calculated.points.map((point) => ({
        kind: point.kind,
        conditionValue: decimalToStringOrNull(point.conditionValue),
        targetNominal: decimalToStringOrNull(point.targetNominal),
        asFoundReference: decimalToStringOrNull(point.asFoundReference),
        asFoundReading: decimalToStringOrNull(point.asFoundReading),
        asFoundDeviation: decimalToStringOrNull(point.asFoundDeviation),
        asFoundInTolerance: point.asFoundInTolerance,
        asLeftReference: decimalToStringOrNull(point.asLeftReference),
        asLeftReading: decimalToStringOrNull(point.asLeftReading),
        asLeftDeviation: decimalToStringOrNull(point.asLeftDeviation),
        asLeftInTolerance: point.asLeftInTolerance,
      })),
      readings: [],
    });

    rowStatus[measurementInput.deviceSelectionId] = {
      status: calculated.status,
      statusReason: calculated.statusReason,
      requiredAdjustment: calculated.requiredAdjustment,
    };
  }

  const overallStatus = aggregateCertificateStatus(
    measurements.map((measurement) => measurement.status)
  );

  await commitLocal({
    reportId: input.reportId,
    certificateId: input.certificateId,
    type: "upsertMeasurement",
    payload: input,
    updateData: (data) => {
      data.measurements = measurements;
    },
    local: { mode: "POINTS", input, rowStatus, overallStatus },
  });

  return { ok: true, certificateStatus: overallStatus };
}

// ============ Test readings ============

export async function saveTestReadings(
  input: UpsertTestReadingsInput,
  online: boolean
): Promise<SaveResult> {
  if (online) {
    return (await upsertTestReadings(input)) ?? { ok: false };
  }

  const cert = await loadCertificate(input.certificateId);
  const config = getCertificateConfig(input.certificateType);
  const expectedCount = config.testReadingCount ?? 2;
  const params = normalizeTestParams(input.params);
  const target = testTarget(input.certificateType, params);
  const tolerances = toleranceMapFor(cert.data.deviceSelections);

  let rows;
  try {
    rows = calculateTestReadings({
      certificateType: input.certificateType,
      expectedCount,
      target,
      measurements: input.measurements.map((measurement) => {
        const tolerance = tolerances.get(measurement.deviceSelectionId);
        if (!tolerance) throw new Error("offline_device_missing");
        return {
          deviceSelectionId: measurement.deviceSelectionId,
          notes: measurement.notes,
          readings: measurement.readings,
          toleranceValue: tolerance.value,
          toleranceIsPercent: tolerance.isPercent,
        };
      }),
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "offline_error",
    };
  }

  const measurements: OfflineMeasurement[] = rows.map((row) => ({
    deviceSelectionId: row.deviceSelectionId,
    notes: row.notes,
    correctionMethod: null,
    requiredAdjustment: false,
    status: row.status,
    statusReason: row.statusReason,
    points: [],
    readings: row.readings,
  }));

  const rowStatus: LocalCertState["rowStatus"] = {};
  for (const row of rows) {
    rowStatus[row.deviceSelectionId] = {
      status: row.status,
      statusReason: row.statusReason,
      requiredAdjustment: false,
    };
  }

  const overallStatus = aggregateCertificateStatus(
    measurements.map((measurement) => measurement.status)
  );

  await commitLocal({
    reportId: input.reportId,
    certificateId: input.certificateId,
    type: "upsertTestReadings",
    payload: input,
    updateData: (data) => {
      data.measurements = measurements;
      data.params = params;
    },
    local: { mode: "TEST_READINGS", input, rowStatus, overallStatus },
  });

  return { ok: true, certificateStatus: overallStatus };
}

// ============ Verificación (Exhaust) ============

export async function saveVerification(
  input: UpsertVerificationInput,
  online: boolean
): Promise<SaveResult> {
  if (online) {
    return (await upsertVerification(input)) ?? { ok: false };
  }

  const complete = hasCompleteVerificationRows(input.rows);
  const overallStatus: CertificateStatus = complete ? "PASS" : "PENDING";

  await commitLocal({
    reportId: input.reportId,
    certificateId: input.certificateId,
    type: "upsertVerification",
    payload: input,
    updateData: (data) => {
      data.verificationRows = input.rows.map((row) => ({
        motorTag: row.motorTag,
        description: row.description,
        rowLabel: row.rowLabel,
        scfm: row.scfm || null,
        driveFrequencyHz: row.notApplicable ? null : row.driveFrequencyHz || null,
        notApplicable: row.notApplicable,
        displayOrder: row.displayOrder,
        notes: row.notes?.trim() || null,
      }));
    },
    local: { mode: "VERIFICATION", input, rowStatus: {}, overallStatus },
  });

  return { ok: true, certificateStatus: overallStatus };
}

// ============ Firma de certificado ============

export async function saveCertificateSignature(
  input: { reportId: string; certificateId: string; signatureDataUrl: string },
  online: boolean
): Promise<SaveResult> {
  if (online) {
    return (await signCertificate(input)) ?? { ok: false };
  }

  const db = getDb();
  const meta = await db.meta.get("session");
  const signature: OfflineSignature = {
    id: `local-${Date.now()}`,
    certificateId: input.certificateId,
    signatureImageUrl: input.signatureDataUrl,
    signedAt: new Date().toISOString(),
    signerName: meta?.name ?? "—",
    signerTitle: meta?.title ?? "",
  };

  await db.transaction("rw", db.certificates, db.reports, db.outbox, async () => {
    const cert = await db.certificates.get(input.certificateId);
    if (!cert) throw new Error("offline_certificate_missing");
    cert.signature = signature;
    cert.syncState = "dirty";
    cert.updatedAt = Date.now();
    await db.certificates.put(cert);

    await enqueueOp({
      reportId: input.reportId,
      certificateId: input.certificateId,
      type: "signCertificate",
      payload: input,
    });
  });

  return { ok: true };
}

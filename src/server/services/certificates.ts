import {
  CertificateStatus,
  CertificateType,
  MeasurementStatus,
  PointKind,
  ReportStatus,
  type UserRole,
} from "@prisma/client";
import { Decimal } from "decimal.js";
import { prisma } from "@/server/db";
import {
  IndeterminateToleranceError,
  aggregateCertificateStatus as aggregateOverallStatus,
  evaluatePointSet,
  type MeasurementOverall,
} from "@/server/domain/calibration";
import { getCertificateConfig, isPointLayout } from "@/lib/certificates";
import { logAudit } from "@/server/services/audit";
import { revokeCertificateSignatures } from "@/server/services/signatures";
import type {
  CertificateMeasurementRowInput,
  MeasurementPointInput,
  UpsertMeasurementInput,
  UpdateCertificateNotesInput,
} from "@/lib/validations/measurements";

type Actor = {
  id: string;
  role: UserRole;
};

function toDecimalOrNull(value: string | undefined): Decimal | null {
  return value ? new Decimal(value) : null;
}

function toPrismaDecimalValue(value: Decimal | null): string | null {
  return value ? value.toString() : null;
}

async function getEditableReport(reportId: string, actor: Actor) {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: {
      filler: { include: { model: true } },
      preparedBy: { select: { id: true, name: true } },
    },
  });

  if (!report) return null;
  if (report.status !== ReportStatus.DRAFT) return null;
  if (actor.role !== "ADMIN" && report.preparedById !== actor.id) return null;

  return report;
}

export async function getCertificateForWizard(
  reportId: string,
  certificateType: CertificateType,
  actor: Actor
) {
  const report = await getEditableReport(reportId, actor);
  if (!report) return null;

  const [certificate, deviceSelections] = await Promise.all([
    prisma.certificate.findUnique({
      where: { reportId_certificateType: { reportId, certificateType } },
      include: { primaryStandard: true },
    }),
    prisma.reportDeviceSelection.findMany({
      where: {
        reportId,
        included: true,
        certificateTypesSnapshot: { has: certificateType },
      },
      orderBy: [{ displayOrderSnapshot: "asc" }, { tagNumberSnapshot: "asc" }],
    }),
  ]);

  if (!certificate) {
    return { report, certificate: null, deviceSelections, measurements: [] };
  }

  const measurements = await prisma.certificateMeasurement.findMany({
    where: {
      certificateId: certificate.id,
      deviceSelectionId: { in: deviceSelections.map((selection) => selection.id) },
    },
    include: { points: true },
  });

  return { report, certificate, deviceSelections, measurements };
}

export type CalculatedPoint = {
  kind: PointKind;
  conditionValue: Decimal | null;
  targetNominal: Decimal | null;
  asFoundReference: Decimal | null;
  asFoundReading: Decimal | null;
  asFoundDeviation: Decimal | null;
  asFoundInTolerance: boolean | null;
  asLeftReference: Decimal | null;
  asLeftReading: Decimal | null;
  asLeftDeviation: Decimal | null;
  asLeftInTolerance: boolean | null;
};

export type CalculatedMeasurement = {
  points: CalculatedPoint[];
  status: MeasurementStatus;
  statusReason: string | null;
  requiredAdjustment: boolean;
};

function rawPoint(input: MeasurementPointInput): CalculatedPoint {
  return {
    kind: input.kind,
    conditionValue: toDecimalOrNull(input.conditionValue),
    targetNominal: toDecimalOrNull(input.targetNominal),
    asFoundReference: toDecimalOrNull(input.asFoundReference),
    asFoundReading: toDecimalOrNull(input.asFoundReading),
    asFoundDeviation: null,
    asFoundInTolerance: null,
    asLeftReference: toDecimalOrNull(input.asLeftReference),
    asLeftReading: toDecimalOrNull(input.asLeftReading),
    asLeftDeviation: null,
    asLeftInTolerance: null,
  };
}

function pendingMeasurement(
  points: CalculatedPoint[],
  statusReason: string
): CalculatedMeasurement {
  return {
    points,
    status: MeasurementStatus.PENDING,
    statusReason,
    requiredAdjustment: false,
  };
}

/** Un pase está completo con reference + reading, y parcial con solo uno. */
function passState(reference: Decimal | null, reading: Decimal | null) {
  return {
    complete: Boolean(reference && reading),
    partial: Boolean(reference) !== Boolean(reading),
  };
}

/**
 * Calcula el estado de un dispositivo a partir de sus puntos.
 *
 * El Pass/Fail se decide sobre el pase As Left cuando fue capturado. Un As Found
 * fuera de tolerancia no reprueba: significa que el instrumento derivó y hubo
 * que ajustarlo. deviation = reading - reference. Ver el motor de dominio.
 */
export function calculateMeasurementStatus(params: {
  input: CertificateMeasurementRowInput;
  toleranceValue: Decimal | string;
  toleranceIsPercent: boolean;
}): CalculatedMeasurement {
  const rawPoints = params.input.points.map(rawPoint);

  const passes = rawPoints.map((point) => ({
    found: passState(point.asFoundReference, point.asFoundReading),
    left: passState(point.asLeftReference, point.asLeftReading),
  }));

  const anyComplete = passes.some((p) => p.found.complete || p.left.complete);
  const anyPartial = passes.some((p) => p.found.partial || p.left.partial);

  if (!anyComplete && !anyPartial) {
    return pendingMeasurement(rawPoints, "Sin mediciones capturadas");
  }

  if (anyPartial) {
    return pendingMeasurement(
      rawPoints,
      "En algún pase falta la referencia del patrón o la lectura del UUT"
    );
  }

  const toleranceValue = params.toleranceValue.toString();

  let evaluated;
  try {
    evaluated = evaluatePointSet(
      rawPoints.map((point) => ({
        kind: point.kind,
        input: {
          targetNominal: point.targetNominal,
          asFound:
            point.asFoundReference && point.asFoundReading
              ? { reference: point.asFoundReference, reading: point.asFoundReading }
              : null,
          asLeft:
            point.asLeftReference && point.asLeftReading
              ? { reference: point.asLeftReference, reading: point.asLeftReading }
              : null,
          toleranceValue,
          toleranceIsPercent: params.toleranceIsPercent,
        },
      }))
    );
  } catch (error) {
    if (error instanceof IndeterminateToleranceError) {
      return pendingMeasurement(rawPoints, error.message);
    }
    throw error;
  }

  const resultByKind = new Map(
    evaluated.points.map((point) => [point.kind, point.result])
  );

  const points: CalculatedPoint[] = rawPoints.map((point) => {
    const result = resultByKind.get(point.kind);
    if (!result) return point;

    return {
      ...point,
      asFoundDeviation: result.asFound?.deviation ?? null,
      asFoundInTolerance: result.asFound?.inTolerance ?? null,
      asLeftDeviation: result.asLeft?.deviation ?? null,
      asLeftInTolerance: result.asLeft?.inTolerance ?? null,
    };
  });

  const failed = evaluated.overall === "fail";

  return {
    points,
    status: failed ? MeasurementStatus.FAIL : MeasurementStatus.PASS,
    statusReason: buildStatusReason({
      failed,
      requiredAdjustment: evaluated.requiredAdjustment,
    }),
    requiredAdjustment: evaluated.requiredAdjustment,
  };
}

function buildStatusReason(params: {
  failed: boolean;
  requiredAdjustment: boolean;
}): string | null {
  if (params.failed) {
    return params.requiredAdjustment
      ? "As found fuera de tolerancia y el As Left sigue fuera de tolerancia"
      : "As Left fuera de tolerancia";
  }

  return params.requiredAdjustment
    ? "As Found fuera de tolerancia; ajustado y verificado dentro de tolerancia"
    : null;
}

const MEASUREMENT_TO_OVERALL: Record<MeasurementStatus, MeasurementOverall | "pending"> = {
  [MeasurementStatus.PENDING]: "pending",
  [MeasurementStatus.PASS]: "pass",
  [MeasurementStatus.FAIL]: "fail",
  [MeasurementStatus.NA]: "na",
};

const OVERALL_TO_CERTIFICATE: Record<
  ReturnType<typeof aggregateOverallStatus>,
  CertificateStatus
> = {
  pending: CertificateStatus.PENDING,
  pass: CertificateStatus.PASS,
  fail: CertificateStatus.FAIL,
  mixed: CertificateStatus.MIXED,
};

export function aggregateCertificateStatus(
  statuses: MeasurementStatus[]
): CertificateStatus {
  const overall = aggregateOverallStatus(
    statuses.map((status) => MEASUREMENT_TO_OVERALL[status])
  );

  return OVERALL_TO_CERTIFICATE[overall];
}

async function recalculateCertificateStatus(certificateId: string, userId: string) {
  const certificate = await prisma.certificate.findUnique({
    where: { id: certificateId },
    include: { measurements: { select: { status: true } } },
  });

  if (!certificate) {
    throw new Error("Certificado no encontrado.");
  }

  const nextStatus = aggregateCertificateStatus(
    certificate.measurements.map((measurement) => measurement.status)
  );

  if (certificate.overallStatus !== nextStatus) {
    await prisma.certificate.update({
      where: { id: certificate.id },
      data: { overallStatus: nextStatus },
    });

    await logAudit({
      entityType: "Certificate",
      entityId: certificate.id,
      action: "update_overall_status",
      userId,
      changes: { from: certificate.overallStatus, to: nextStatus },
    });
  }

  return nextStatus;
}

export async function upsertCertificateMeasurement(
  actor: Actor,
  input: UpsertMeasurementInput
) {
  const report = await getEditableReport(input.reportId, actor);
  if (!report) {
    throw new Error("Reporte no encontrado o no editable.");
  }

  const certificate = await prisma.certificate.findFirst({
    where: {
      id: input.certificateId,
      reportId: report.id,
      certificateType: input.certificateType,
    },
  });

  if (!certificate) {
    throw new Error("Certificado no encontrado para este reporte.");
  }

  const config = getCertificateConfig(certificate.certificateType);
  if (!isPointLayout(certificate.layout)) {
    throw new Error(
      `El certificado ${config.label} no se captura por puntos de calibración.`
    );
  }

  const allowedKinds = new Set<PointKind>(config.pointKinds);
  for (const measurement of input.measurements) {
    for (const point of measurement.points) {
      if (!allowedKinds.has(point.kind)) {
        throw new Error(
          `El punto ${point.kind} no aplica al certificado ${config.label}.`
        );
      }
    }
  }

  const deviceSelections = await prisma.reportDeviceSelection.findMany({
    where: {
      reportId: report.id,
      included: true,
      certificateTypesSnapshot: { has: input.certificateType },
      id: { in: input.measurements.map((measurement) => measurement.deviceSelectionId) },
    },
  });
  const deviceSelectionById = new Map(
    deviceSelections.map((selection) => [selection.id, selection])
  );

  if (deviceSelections.length !== input.measurements.length) {
    throw new Error("Una medición no pertenece a este reporte o certificado.");
  }

  for (const measurementInput of input.measurements) {
    const selection = deviceSelectionById.get(measurementInput.deviceSelectionId);
    if (!selection) {
      throw new Error("Dispositivo inválido para este certificado.");
    }

    const calculated = calculateMeasurementStatus({
      input: measurementInput,
      toleranceValue: selection.toleranceValueSnapshot.toString(),
      toleranceIsPercent: selection.toleranceIsPercentSnapshot,
    });

    const measurementData = {
      correctionMethod: measurementInput.correctionMethod?.trim() || null,
      status: calculated.status,
      statusReason: calculated.statusReason,
      requiredAdjustment: calculated.requiredAdjustment,
    };

    const measurement = await prisma.$transaction(async (tx) => {
      const saved = await tx.certificateMeasurement.upsert({
        where: {
          certificateId_deviceSelectionId: {
            certificateId: certificate.id,
            deviceSelectionId: selection.id,
          },
        },
        update: measurementData,
        create: {
          certificateId: certificate.id,
          deviceSelectionId: selection.id,
          ...measurementData,
        },
      });

      // Los puntos se reemplazan enteros: son pocos y así evitamos dejar
      // puntos huérfanos si el layout cambia.
      await tx.measurementPoint.deleteMany({ where: { measurementId: saved.id } });
      await tx.measurementPoint.createMany({
        data: calculated.points.map((point) => ({
          measurementId: saved.id,
          kind: point.kind,
          conditionValue: toPrismaDecimalValue(point.conditionValue),
          targetNominal: toPrismaDecimalValue(point.targetNominal),
          asFoundReference: toPrismaDecimalValue(point.asFoundReference),
          asFoundReading: toPrismaDecimalValue(point.asFoundReading),
          asFoundDeviation: toPrismaDecimalValue(point.asFoundDeviation),
          asFoundInTolerance: point.asFoundInTolerance,
          asLeftReference: toPrismaDecimalValue(point.asLeftReference),
          asLeftReading: toPrismaDecimalValue(point.asLeftReading),
          asLeftDeviation: toPrismaDecimalValue(point.asLeftDeviation),
          asLeftInTolerance: point.asLeftInTolerance,
        })),
      });

      // Una firma vale sobre el contenido firmado. Si las mediciones cambian,
      // la validación del preparador deja de aplicar.
      const revoked = await revokeCertificateSignatures(tx, certificate.id);

      return { saved, revoked };
    });

    await logAudit({
      entityType: "CertificateMeasurement",
      entityId: measurement.saved.id,
      action: "upsert",
      userId: actor.id,
      changes: {
        certificateId: certificate.id,
        deviceSelectionId: selection.id,
        status: calculated.status,
        requiredAdjustment: calculated.requiredAdjustment,
        revokedSignatures: measurement.revoked,
      },
    });
  }

  return recalculateCertificateStatus(certificate.id, actor.id);
}

export async function updateCertificateNotes(
  actor: Actor,
  input: UpdateCertificateNotesInput
) {
  const report = await getEditableReport(input.reportId, actor);
  if (!report) {
    throw new Error("Reporte no encontrado o no editable.");
  }

  const existing = await prisma.certificate.findFirst({
    where: { id: input.certificateId, reportId: report.id },
  });

  if (!existing) {
    throw new Error("Certificado inválido para este reporte.");
  }

  const certificate = await prisma.certificate.update({
    where: { id: existing.id },
    data: { notes: input.notes?.trim() || null },
  });

  await logAudit({
    entityType: "Certificate",
    entityId: certificate.id,
    action: "update_notes",
    userId: actor.id,
    changes: { notes: input.notes?.trim() || null },
  });

  return certificate;
}

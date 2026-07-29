import {
  CertificateLayout,
  CertificateStatus,
  ReportStatus,
  SignerRole,
  type Prisma,
  type UserRole,
} from "@prisma/client";
import { headers } from "next/headers";
import { prisma } from "@/server/db";
import {
  hashSignaturePayload,
  type CertificateSignaturePayload,
  type ReportSignaturePayload,
  type SignedStandard,
} from "@/server/domain/signature-payload";
import {
  hasCompleteCertificateMeasurement,
  hasCompleteTestReadings,
  hasCompleteVerificationRows,
} from "@/server/domain/certificate-completeness";
import { getCertificateConfig } from "@/lib/certificates";
import { storeSignatureImage } from "@/server/services/signature-storage";
import { logAudit } from "@/server/services/audit";

type Actor = {
  id: string;
  role: UserRole;
};

/**
 * IP y user agent son evidencia complementaria de la firma, no un requisito:
 * ambas columnas son nullable. Fuera de un request (scripts, tests) `headers()`
 * lanza, y eso no debe impedir firmar.
 */
async function getRequestContext(): Promise<{
  ipAddress: string | null;
  userAgent: string | null;
}> {
  try {
    const h = await headers();

    return {
      ipAddress:
        h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null,
      userAgent: h.get("user-agent") ?? null,
    };
  } catch {
    return { ipAddress: null, userAgent: null };
  }
}

function decimalToString(value: { toString(): string } | null | undefined) {
  return value ? value.toString() : null;
}

function dateOnly(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

/** Snapshot del patrón tal como se imprime en su bloque de validación. */
function signedStandard(
  role: "primary" | "additional",
  standard: {
    descriptionSnapshot: string;
    manufacturerSnapshot: string;
    modelSnapshot: string;
    serialSnapshot: string;
    certificationStatusSnapshot: string;
    certNumberSnapshot: string | null;
    calDateSnapshot: Date | null;
    calExpiresAtSnapshot: Date | null;
  }
): SignedStandard {
  return {
    role,
    description: standard.descriptionSnapshot,
    manufacturer: standard.manufacturerSnapshot,
    model: standard.modelSnapshot,
    serial: standard.serialSnapshot,
    certificationStatus: standard.certificationStatusSnapshot,
    certNumber: standard.certNumberSnapshot,
    calibrationDate: dateOnly(standard.calDateSnapshot),
    validTo: dateOnly(standard.calExpiresAtSnapshot),
  };
}

async function getEditableReport(reportId: string, actor: Actor) {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: { filler: true },
  });

  if (!report) return null;
  if (report.status !== ReportStatus.DRAFT) return null;
  if (actor.role !== "ADMIN" && report.preparedById !== actor.id) return null;

  return report;
}

/**
 * Payload firmado de un certificado: todo lo que el preparador está validando
 * al firmar esa página.
 */
async function buildCertificatePayload(
  certificateId: string
): Promise<CertificateSignaturePayload> {
  const certificate = await prisma.certificate.findUnique({
    where: { id: certificateId },
    include: {
      report: { select: { reportNumber: true } },
      primaryStandard: true,
      additionalStandards: {
        include: { reportStandard: true },
        orderBy: { displayOrder: "asc" },
      },
      measurements: {
        include: {
          deviceSelection: true,
          points: true,
          readings: true,
        },
      },
      verificationRows: true,
    },
  });

  if (!certificate) {
    throw new Error("Certificado no encontrado.");
  }

  return {
    scope: "certificate",
    reportNumber: certificate.report.reportNumber,
    certificateType: certificate.certificateType,
    overallStatus: certificate.overallStatus,
    standards: [
      signedStandard("primary", certificate.primaryStandard),
      ...certificate.additionalStandards.map((link) =>
        signedStandard("additional", link.reportStandard)
      ),
    ],
    notes: certificate.notes,
    params: certificate.params,
    measurements: certificate.measurements.map((measurement) => ({
      tagNumber: measurement.deviceSelection.tagNumberSnapshot,
      description: measurement.deviceSelection.descriptionSnapshot,
      toleranceValue: measurement.deviceSelection.toleranceValueSnapshot.toString(),
      toleranceUnit: measurement.deviceSelection.toleranceUnitSnapshot,
      toleranceIsPercent: measurement.deviceSelection.toleranceIsPercentSnapshot,
      displayOrder: measurement.deviceSelection.displayOrderSnapshot,
      status: measurement.status,
      requiredAdjustment: measurement.requiredAdjustment,
      correctionMethod: measurement.correctionMethod,
      notes: measurement.notes,
      points: measurement.points.map((point) => ({
        kind: point.kind,
        notApplicable: point.notApplicable,
        targetNominal: decimalToString(point.targetNominal),
        asFoundReference: decimalToString(point.asFoundReference),
        asFoundReading: decimalToString(point.asFoundReading),
        asLeftReference: decimalToString(point.asLeftReference),
        asLeftReading: decimalToString(point.asLeftReading),
      })),
      readings: measurement.readings.map((reading) => ({
        sequence: reading.sequence,
        value: decimalToString(reading.value),
        target: decimalToString(reading.target),
      })),
    })),
    verificationRows: certificate.verificationRows.map((row) => ({
      motorTag: row.motorTag,
      description: row.description,
      rowLabel: row.rowLabel,
      scfm: decimalToString(row.scfm),
      driveFrequencyHz: decimalToString(row.driveFrequencyHz),
      notApplicable: row.notApplicable,
      displayOrder: row.displayOrder,
      notes: row.notes,
    })),
  };
}

/** Revoca la firma general del reporte. */
export async function revokeReportSignatures(
  tx: Prisma.TransactionClient,
  reportId: string
): Promise<number> {
  const result = await tx.signature.updateMany({
    where: { reportId, certificateId: null, revoked: false },
    data: { revoked: true, revokedAt: new Date() },
  });

  return result.count;
}

/**
 * Payload firmado del reporte: identidad, alcance y las firmas vigentes de sus
 * certificados. Se arma igual al firmar y al verificar, para que el hash sea
 * comparable.
 */
async function buildReportPayload(reportId: string): Promise<ReportSignaturePayload> {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: {
      filler: { select: { serialNumber: true } },
      deviceSelections: true,
      certificates: {
        include: { signatures: { where: { revoked: false }, orderBy: { signedAt: "desc" } } },
      },
    },
  });

  if (!report) {
    throw new Error("Reporte no encontrado.");
  }

  return {
    scope: "report",
    reportNumber: report.reportNumber,
    serviceDate: report.serviceDate.toISOString().slice(0, 10),
    fillerSerial: report.filler.serialNumber,
    observations: report.observations,
    checklist: report.deviceSelections.map((selection) => ({
      tagNumber: selection.tagNumberSnapshot,
      description: selection.descriptionSnapshot,
      deviceType: selection.deviceTypeSnapshot,
      toleranceValue: selection.toleranceValueSnapshot.toString(),
      toleranceUnit: selection.toleranceUnitSnapshot,
      toleranceIsPercent: selection.toleranceIsPercentSnapshot,
      certificateTypes: selection.certificateTypesSnapshot,
      displayOrder: selection.displayOrderSnapshot,
      included: selection.included,
      exclusionReason: selection.exclusionReason,
    })),
    certificates: report.certificates
      .filter((certificate) => certificate.signatures.length > 0)
      .map((certificate) => ({
        certificateType: certificate.certificateType,
        payloadHash: certificate.signatures[0]!.payloadHash,
      })),
  };
}

export type StaleSignatures = {
  /** Certificados cuya firma ya no corresponde a su contenido actual. */
  certificateTypes: string[];
  /** La firma general dejó de corresponder al reporte. */
  report: boolean;
};

/**
 * Recalcula los hashes de las firmas vigentes y los compara con los guardados.
 *
 * Es la red de seguridad del modelo de firmas: la revocación al editar depende
 * de que cada camino de escritura se acuerde de revocar, y esto detecta el que
 * se haya olvidado antes de que el reporte se emita.
 */
export async function findStaleSignatures(
  reportId: string
): Promise<StaleSignatures> {
  const certificates = await prisma.certificate.findMany({
    where: { reportId, signatures: { some: { revoked: false } } },
    include: {
      signatures: { where: { revoked: false }, orderBy: { signedAt: "desc" }, take: 1 },
    },
  });

  const certificateTypes: string[] = [];
  for (const certificate of certificates) {
    const expected = hashSignaturePayload(await buildCertificatePayload(certificate.id));
    if (expected !== certificate.signatures[0]!.payloadHash) {
      certificateTypes.push(certificate.certificateType);
    }
  }

  const reportSignature = await prisma.signature.findFirst({
    where: { reportId, certificateId: null, revoked: false },
    orderBy: { signedAt: "desc" },
  });

  const reportStale = reportSignature
    ? hashSignaturePayload(await buildReportPayload(reportId)) !==
      reportSignature.payloadHash
    : false;

  return { certificateTypes, report: reportStale };
}

/**
 * Revoca la firma activa de un certificado y, en cascada, la del reporte.
 *
 * Se llama cada vez que cambia el contenido firmado de la sección: mediciones,
 * filas de verificación o patrones. Una firma vale sobre el contenido que se
 * firmó, no sobre el certificado como identidad.
 *
 * La firma del reporte cae con ella porque se calcula sobre los hashes de las
 * firmas de sus certificados: si una deja de valer, el reporte estaría
 * acreditando un conjunto que ya no existe.
 */
export async function revokeCertificateSignatures(
  tx: Prisma.TransactionClient,
  certificateId: string
): Promise<number> {
  const certificate = await tx.certificate.findUnique({
    where: { id: certificateId },
    select: { reportId: true },
  });

  const result = await tx.signature.updateMany({
    where: { certificateId, revoked: false },
    data: { revoked: true, revokedAt: new Date() },
  });

  if (certificate) {
    await revokeReportSignatures(tx, certificate.reportId);
  }

  return result.count;
}

export async function signCertificate(
  actor: Actor,
  input: { reportId: string; certificateId: string; signatureDataUrl: string }
) {
  const report = await getEditableReport(input.reportId, actor);
  if (!report) {
    throw new Error("Reporte no encontrado o no editable.");
  }

  const certificate = await prisma.certificate.findFirst({
    where: { id: input.certificateId, reportId: report.id },
    include: {
      measurements: { include: { points: true, readings: true } },
      verificationRows: true,
    },
  });

  if (!certificate) {
    throw new Error("Certificado inválido para este reporte.");
  }

  const expectedSelections = await prisma.reportDeviceSelection.findMany({
    where: {
      reportId: report.id,
      included: true,
      certificateTypesSnapshot: { has: certificate.certificateType },
    },
    select: { id: true },
  });
  const expectedSelectionIds = new Set(
    expectedSelections.map((selection) => selection.id)
  );
  const relevantMeasurements = certificate.measurements.filter((measurement) =>
    expectedSelectionIds.has(measurement.deviceSelectionId)
  );
  const config = getCertificateConfig(certificate.certificateType);
  const measurementsComplete =
    certificate.layout === CertificateLayout.VERIFICATION
      ? hasCompleteVerificationRows(certificate.verificationRows)
      : relevantMeasurements.length === expectedSelections.length &&
        expectedSelections.length > 0 &&
        relevantMeasurements.every((measurement) =>
          certificate.layout === CertificateLayout.TEST_READINGS
            ? hasCompleteTestReadings(
                config.testReadingCount ?? 2,
                measurement.readings
              )
            : hasCompleteCertificateMeasurement(
                certificate.certificateType,
                measurement.points
              )
        );

  if (
    !measurementsComplete ||
    certificate.overallStatus === CertificateStatus.PENDING
  ) {
    throw new Error(
      "No puedes firmar un certificado con mediciones pendientes. Completa la captura primero."
    );
  }

  const payload = await buildCertificatePayload(certificate.id);
  const payloadHash = hashSignaturePayload(payload);
  const context = await getRequestContext();

  const signatureImageUrl = await storeSignatureImage({
    dataUrl: input.signatureDataUrl,
    reportId: report.id,
    signatureKey: `cert-${certificate.certificateType.toLowerCase()}`,
  });

  const signature = await prisma.$transaction(async (tx) => {
    await revokeCertificateSignatures(tx, certificate.id);

    return tx.signature.create({
      data: {
        reportId: report.id,
        certificateId: certificate.id,
        signerUserId: actor.id,
        signerRole: SignerRole.PREPARER,
        signatureImageUrl,
        payloadHash,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });
  });

  await logAudit({
    entityType: "Certificate",
    entityId: certificate.id,
    action: "sign",
    userId: actor.id,
    changes: { signatureId: signature.id, payloadHash },
  });

  return signature;
}

export async function signReport(
  actor: Actor,
  input: { reportId: string; signatureDataUrl: string }
) {
  const report = await getEditableReport(input.reportId, actor);
  if (!report) {
    throw new Error("Reporte no encontrado o no editable.");
  }

  const certificates = await prisma.certificate.findMany({
    where: { reportId: report.id },
    include: { signatures: { where: { revoked: false } } },
  });

  if (certificates.length === 0) {
    throw new Error("El reporte no tiene certificados que validar.");
  }

  const unsigned = certificates.filter(
    (certificate) => certificate.signatures.length === 0
  );

  if (unsigned.length > 0) {
    throw new Error(
      `Faltan firmar ${unsigned.length} certificado(s) antes de firmar el reporte.`
    );
  }

  const payload = await buildReportPayload(report.id);
  const payloadHash = hashSignaturePayload(payload);
  const context = await getRequestContext();

  const signatureImageUrl = await storeSignatureImage({
    dataUrl: input.signatureDataUrl,
    reportId: report.id,
    signatureKey: "report",
  });

  const signature = await prisma.$transaction(async (tx) => {
    // Postgres trata los NULL como distintos, así que el @@unique no alcanza
    // para impedir dos firmas de reporte del mismo firmante. Se revoca la
    // anterior explícitamente.
    await tx.signature.updateMany({
      where: { reportId: report.id, certificateId: null, revoked: false },
      data: { revoked: true, revokedAt: new Date() },
    });

    return tx.signature.create({
      data: {
        reportId: report.id,
        certificateId: null,
        signerUserId: actor.id,
        signerRole: SignerRole.PREPARER,
        signatureImageUrl,
        payloadHash,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });
  });

  await logAudit({
    entityType: "Report",
    entityId: report.id,
    action: "sign",
    userId: actor.id,
    changes: { signatureId: signature.id, payloadHash },
  });

  return signature;
}

export async function getActiveCertificateSignature(certificateId: string) {
  return prisma.signature.findFirst({
    where: { certificateId, revoked: false },
    include: { signer: { select: { name: true, title: true } } },
    orderBy: { signedAt: "desc" },
  });
}

export async function getActiveReportSignature(reportId: string) {
  return prisma.signature.findFirst({
    where: { reportId, certificateId: null, revoked: false },
    include: { signer: { select: { name: true, title: true } } },
    orderBy: { signedAt: "desc" },
  });
}

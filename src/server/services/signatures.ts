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
      primaryStandard: { select: { serialSnapshot: true } },
      measurements: {
        include: {
          deviceSelection: { select: { tagNumberSnapshot: true } },
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
    standardSerial: certificate.primaryStandard.serialSnapshot,
    notes: certificate.notes,
    params: certificate.params,
    measurements: certificate.measurements.map((measurement) => ({
      tagNumber: measurement.deviceSelection.tagNumberSnapshot,
      status: measurement.status,
      requiredAdjustment: measurement.requiredAdjustment,
      correctionMethod: measurement.correctionMethod,
      points: measurement.points.map((point) => ({
        kind: point.kind,
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
    })),
  };
}

/**
 * Revoca la firma activa de un certificado. Se llama cada vez que cambian sus
 * mediciones: una firma vale sobre el contenido que se firmó, no sobre el
 * certificado como identidad.
 */
export async function revokeCertificateSignatures(
  tx: Prisma.TransactionClient,
  certificateId: string
): Promise<number> {
  const result = await tx.signature.updateMany({
    where: { certificateId, revoked: false },
    data: { revoked: true, revokedAt: new Date() },
  });

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

  const payload: ReportSignaturePayload = {
    scope: "report",
    reportNumber: report.reportNumber,
    serviceDate: report.serviceDate.toISOString().slice(0, 10),
    fillerSerial: report.filler.serialNumber,
    observations: report.observations,
    certificates: certificates.map((certificate) => ({
      certificateType: certificate.certificateType,
      payloadHash: certificate.signatures[0]!.payloadHash,
    })),
  };
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

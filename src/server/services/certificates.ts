import {
  CertificateLayout,
  CertificateStatus,
  CertificateType,
  PointKind,
  ReportStatus,
  type Prisma,
  type UserRole,
} from "@prisma/client";
import { prisma } from "@/server/db";
import { hasCompleteVerificationRows } from "@/server/domain/certificate-completeness";
import {
  aggregateCertificateStatus,
  calculateMeasurementStatus,
  calculateTestReadings,
  decimalToStringOrNull as toPrismaDecimalValue,
  normalizeTestParams,
  testTarget,
} from "@/shared/domain/measurement-status";
import { getCertificateConfig, isPointLayout } from "@/lib/certificates";
import { logAudit } from "@/server/services/audit";
import { revokeCertificateSignatures } from "@/server/services/signatures";
import type {
  UpsertMeasurementInput,
  UpsertTestReadingsInput,
  UpsertVerificationInput,
} from "@/lib/validations/measurements";

type Actor = {
  id: string;
  role: UserRole;
};

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
      include: { primaryStandard: true, verificationRows: true },
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
    include: { points: true, readings: true },
  });

  return { report, certificate, deviceSelections, measurements };
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
      certificateType: certificate.certificateType,
      input: measurementInput,
      toleranceValue: selection.toleranceValueSnapshot.toString(),
      toleranceIsPercent: selection.toleranceIsPercentSnapshot,
    });

    const measurementData = {
      correctionMethod: measurementInput.correctionMethod?.trim() || null,
      notes: measurementInput.notes?.trim() || null,
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

export async function upsertCertificateTestReadings(
  actor: Actor,
  input: UpsertTestReadingsInput
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
      layout: CertificateLayout.TEST_READINGS,
    },
  });
  if (!certificate) {
    throw new Error("Certificado no encontrado para este reporte.");
  }

  const config = getCertificateConfig(certificate.certificateType);
  const expectedCount = config.testReadingCount ?? 2;
  const params = normalizeTestParams(input.params);
  const target = testTarget(certificate.certificateType, params);

  const selections = await prisma.reportDeviceSelection.findMany({
    where: {
      reportId: report.id,
      included: true,
      certificateTypesSnapshot: { has: input.certificateType },
      id: {
        in: input.measurements.map(
          (measurement) => measurement.deviceSelectionId
        ),
      },
    },
  });
  const selectionById = new Map(
    selections.map((selection) => [selection.id, selection])
  );

  if (selections.length !== input.measurements.length) {
    throw new Error("Una medición no pertenece a este reporte o certificado.");
  }

  const calculated = calculateTestReadings({
    certificateType: certificate.certificateType,
    expectedCount,
    target,
    measurements: input.measurements.map((measurementInput) => {
      const selection = selectionById.get(measurementInput.deviceSelectionId);
      if (!selection) {
        throw new Error("Dispositivo inválido para este certificado.");
      }
      return {
        deviceSelectionId: measurementInput.deviceSelectionId,
        notes: measurementInput.notes,
        readings: measurementInput.readings,
        toleranceValue: selection.toleranceValueSnapshot.toString(),
        toleranceIsPercent: selection.toleranceIsPercentSnapshot,
      };
    }),
  });

  const revoked = await prisma.$transaction(async (tx) => {
    await tx.certificate.update({
      where: { id: certificate.id },
      data: {
        params: params as Prisma.InputJsonObject,
      },
    });

    for (const result of calculated) {
      const measurement = await tx.certificateMeasurement.upsert({
        where: {
          certificateId_deviceSelectionId: {
            certificateId: certificate.id,
            deviceSelectionId: result.deviceSelectionId,
          },
        },
        update: {
          status: result.status,
          statusReason: result.statusReason,
          notes: result.notes,
          requiredAdjustment: false,
          correctionMethod: null,
        },
        create: {
          certificateId: certificate.id,
          deviceSelectionId: result.deviceSelectionId,
          status: result.status,
          statusReason: result.statusReason,
          notes: result.notes,
          requiredAdjustment: false,
        },
      });

      await tx.measurementPoint.deleteMany({
        where: { measurementId: measurement.id },
      });
      await tx.testReading.deleteMany({
        where: { measurementId: measurement.id },
      });
      await tx.testReading.createMany({
        data: result.readings.map((reading) => ({
          measurementId: measurement.id,
          ...reading,
        })),
      });
    }

    return revokeCertificateSignatures(tx, certificate.id);
  });

  await logAudit({
    entityType: "Certificate",
    entityId: certificate.id,
    action: "upsert_test_readings",
    userId: actor.id,
    changes: {
      params,
      measurementCount: calculated.length,
      revokedSignatures: revoked,
    },
  });

  return recalculateCertificateStatus(certificate.id, actor.id);
}

export async function upsertCertificateVerification(
  actor: Actor,
  input: UpsertVerificationInput
) {
  const report = await getEditableReport(input.reportId, actor);
  if (!report) {
    throw new Error("Reporte no encontrado o no editable.");
  }

  const certificate = await prisma.certificate.findFirst({
    where: {
      id: input.certificateId,
      reportId: report.id,
      certificateType: CertificateType.EXHAUST,
      layout: CertificateLayout.VERIFICATION,
    },
  });
  if (!certificate) {
    throw new Error("Certificado no encontrado para este reporte.");
  }

  const complete = hasCompleteVerificationRows(input.rows);
  const nextStatus = complete
    ? CertificateStatus.PASS
    : CertificateStatus.PENDING;

  const revoked = await prisma.$transaction(async (tx) => {
    await tx.verificationRow.deleteMany({
      where: { certificateId: certificate.id },
    });
    await tx.verificationRow.createMany({
      data: input.rows.map((row) => ({
        certificateId: certificate.id,
        motorTag: row.motorTag,
        description: row.description,
        rowLabel: row.rowLabel,
        scfm: row.scfm || null,
        driveFrequencyHz: row.notApplicable
          ? null
          : row.driveFrequencyHz || null,
        notApplicable: row.notApplicable,
        displayOrder: row.displayOrder,
        notes: row.notes?.trim() || null,
      })),
    });
    await tx.certificate.update({
      where: { id: certificate.id },
      data: { overallStatus: nextStatus },
    });

    return revokeCertificateSignatures(tx, certificate.id);
  });

  await logAudit({
    entityType: "Certificate",
    entityId: certificate.id,
    action: "upsert_verification",
    userId: actor.id,
    changes: {
      rowCount: input.rows.length,
      overallStatus: nextStatus,
      revokedSignatures: revoked,
    },
  });

  return nextStatus;
}

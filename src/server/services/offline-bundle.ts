import { ReportStatus, type UserRole } from "@prisma/client";
import { prisma } from "@/server/db";
import { implementedCertificateTypes } from "@/lib/certificates";
import type {
  OfflineCertificate,
  OfflineMeasurement,
  OfflineReportBundle,
  OfflineSignature,
} from "@/lib/offline/bundle-types";

type Actor = { id: string; role: UserRole };

function dec(value: { toString(): string } | null | undefined): string | null {
  return value === null || value === undefined ? null : value.toString();
}

const orderIndex = new Map(
  implementedCertificateTypes.map((type, index) => [type, index])
);

/**
 * Arma la foto completa de un reporte para trabajar offline. Solo borradores
 * editables por el actor (misma regla que el wizard). Todo Decimal se serializa
 * a string y las fechas a ISO.
 */
export async function getOfflineReportBundle(
  reportId: string,
  actor: Actor
): Promise<OfflineReportBundle | null> {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: {
      filler: { include: { model: true } },
      preparedBy: { select: { id: true, name: true, title: true, email: true } },
      standards: true,
      certificates: {
        include: {
          primaryStandard: true,
          additionalStandards: {
            include: { reportStandard: true },
            orderBy: { displayOrder: "asc" },
          },
          verificationRows: true,
          measurements: { include: { points: true, readings: true } },
        },
      },
      deviceSelections: { where: { included: true } },
      signatures: {
        where: { revoked: false },
        include: { signer: { select: { name: true, title: true } } },
      },
    },
  });

  if (!report) return null;
  if (report.status !== ReportStatus.DRAFT) return null;
  if (actor.role !== "ADMIN" && report.preparedById !== actor.id) return null;

  const selectionById = new Map(
    report.deviceSelections.map((selection) => [selection.id, selection])
  );

  const certificates: OfflineCertificate[] = [...report.certificates]
    .sort(
      (a, b) =>
        (orderIndex.get(a.certificateType) ?? 99) -
        (orderIndex.get(b.certificateType) ?? 99)
    )
    .map((certificate) => {
      const certSelections = report.deviceSelections
        .filter((selection) =>
          selection.certificateTypesSnapshot.includes(certificate.certificateType)
        )
        .sort(
          (a, b) =>
            a.displayOrderSnapshot - b.displayOrderSnapshot ||
            a.tagNumberSnapshot.localeCompare(b.tagNumberSnapshot)
        )
        .map((selection) => ({
          id: selection.id,
          tagNumberSnapshot: selection.tagNumberSnapshot,
          descriptionSnapshot: selection.descriptionSnapshot,
          toleranceValueSnapshot: selection.toleranceValueSnapshot.toString(),
          toleranceUnitSnapshot: selection.toleranceUnitSnapshot,
          toleranceIsPercentSnapshot: selection.toleranceIsPercentSnapshot,
          certificateTypesSnapshot: selection.certificateTypesSnapshot,
          displayOrderSnapshot: selection.displayOrderSnapshot,
        }));

      const measurements: OfflineMeasurement[] = certificate.measurements
        .filter((measurement) => selectionById.has(measurement.deviceSelectionId))
        .map((measurement) => ({
          deviceSelectionId: measurement.deviceSelectionId,
          notes: measurement.notes,
          correctionMethod: measurement.correctionMethod,
          requiredAdjustment: measurement.requiredAdjustment,
          status: measurement.status,
          statusReason: measurement.statusReason,
          points: measurement.points.map((point) => ({
            kind: point.kind,
            notApplicable: point.notApplicable,
            conditionValue: dec(point.conditionValue),
            targetNominal: dec(point.targetNominal),
            asFoundReference: dec(point.asFoundReference),
            asFoundReading: dec(point.asFoundReading),
            asFoundDeviation: dec(point.asFoundDeviation),
            asFoundInTolerance: point.asFoundInTolerance,
            asLeftReference: dec(point.asLeftReference),
            asLeftReading: dec(point.asLeftReading),
            asLeftDeviation: dec(point.asLeftDeviation),
            asLeftInTolerance: point.asLeftInTolerance,
          })),
          readings: measurement.readings
            .sort((a, b) => a.sequence - b.sequence)
            .map((reading) => ({
              sequence: reading.sequence,
              value: dec(reading.value),
              target: dec(reading.target),
              deviation: dec(reading.deviation),
              inTolerance: reading.inTolerance,
            })),
        }));

      return {
        id: certificate.id,
        certificateType: certificate.certificateType,
        layout: certificate.layout,
        params: (certificate.params as Record<string, unknown> | null) ?? null,
        overallStatus: certificate.overallStatus,
        primaryStandard: {
          descriptionSnapshot: certificate.primaryStandard.descriptionSnapshot,
          serialSnapshot: certificate.primaryStandard.serialSnapshot,
        },
        additionalStandards: certificate.additionalStandards.map((link) => ({
          descriptionSnapshot: link.reportStandard.descriptionSnapshot,
          serialSnapshot: link.reportStandard.serialSnapshot,
        })),
        deviceSelections: certSelections,
        verificationRows: certificate.verificationRows
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map((row) => ({
            motorTag: row.motorTag,
            description: row.description,
            rowLabel: row.rowLabel,
            scfm: dec(row.scfm),
            driveFrequencyHz: dec(row.driveFrequencyHz),
            notApplicable: row.notApplicable,
            displayOrder: row.displayOrder,
            notes: row.notes,
          })),
        measurements,
      };
    });

  const signatures: OfflineSignature[] = report.signatures.map((signature) => ({
    id: signature.id,
    certificateId: signature.certificateId,
    signatureImageUrl: signature.signatureImageUrl,
    signedAt: signature.signedAt.toISOString(),
    signerName: signature.signer.name,
    signerTitle: signature.signer.title,
  }));

  return {
    version: 1,
    fetchedAt: new Date().toISOString(),
    report: {
      id: report.id,
      reportNumber: report.reportNumber,
      status: report.status,
      serviceDate: report.serviceDate.toISOString(),
      observations: report.observations,
      filler: {
        serialNumber: report.filler.serialNumber,
        modelName: report.filler.model.name,
        clientName: report.filler.clientName,
        clientAddress: report.filler.clientAddress,
        clientCity: report.filler.clientCity,
        clientState: report.filler.clientState,
        clientZip: report.filler.clientZip,
      },
      preparedBy: {
        id: report.preparedBy.id,
        name: report.preparedBy.name,
        title: report.preparedBy.title,
        email: report.preparedBy.email,
      },
      updatedAt: report.updatedAt.toISOString(),
    },
    standards: report.standards.map((standard) => ({
      id: standard.id,
      descriptionSnapshot: standard.descriptionSnapshot,
      manufacturerSnapshot: standard.manufacturerSnapshot,
      modelSnapshot: standard.modelSnapshot,
      serialSnapshot: standard.serialSnapshot,
      certificationStatusSnapshot: standard.certificationStatusSnapshot,
      certNumberSnapshot: standard.certNumberSnapshot,
      calDateSnapshot: standard.calDateSnapshot?.toISOString() ?? null,
      calExpiresAtSnapshot: standard.calExpiresAtSnapshot?.toISOString() ?? null,
    })),
    certificates,
    signatures,
  };
}

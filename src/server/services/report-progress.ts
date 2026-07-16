import {
  CertificateLayout,
  type CertificateType,
  type UserRole,
} from "@prisma/client";
import { prisma } from "@/server/db";
import {
  buildReportProgress,
  type CertificateProgressInput,
  type ReportProgress,
} from "@/server/domain/report-progress";
import {
  hasCompleteCertificateMeasurement,
  hasCompleteTestReadings,
  hasCompleteVerificationRows,
} from "@/server/domain/certificate-completeness";
import {
  getCertificateConfig,
  implementedCertificateTypes,
} from "@/lib/certificates";

type Actor = { id: string; role: UserRole };

/**
 * Estado real de completado del wizard de un reporte.
 *
 * Solo cuenta los tipos de certificado implementados: los que faltan por
 * construir no deben bloquear la firma del reporte.
 */
export async function getReportProgress(
  reportId: string,
  actor: Actor
): Promise<ReportProgress | null> {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: {
      preparedById: true,
      signatures: {
        where: { certificateId: null, revoked: false },
        select: { id: true },
        take: 1,
      },
      deviceSelections: {
        select: { id: true, included: true, certificateTypesSnapshot: true },
      },
      certificates: {
        select: {
          certificateType: true,
          layout: true,
          overallStatus: true,
          signatures: {
            where: { revoked: false },
            select: { id: true },
            take: 1,
          },
          measurements: {
            select: {
              deviceSelectionId: true,
              points: {
                select: {
                  kind: true,
                  conditionValue: true,
                  targetNominal: true,
                  asFoundReference: true,
                  asFoundReading: true,
                  asLeftReference: true,
                  asLeftReading: true,
                },
              },
              readings: {
                select: { value: true, target: true },
              },
            },
          },
          verificationRows: {
            select: {
              scfm: true,
              driveFrequencyHz: true,
              notApplicable: true,
            },
          },
        },
      },
    },
  });

  if (!report) return null;
  if (actor.role !== "ADMIN" && report.preparedById !== actor.id) return null;

  const certificateByType = new Map(
    report.certificates.map((certificate) => [certificate.certificateType, certificate])
  );

  /**
   * Dispositivos que la sección tiene que cubrir. Un dispositivo excluido del
   * alcance no tiene nada que capturar y no cuenta.
   */
  function expectedSelectionIds(certificateType: CertificateType): Set<string> {
    return new Set(
      report!.deviceSelections
        .filter(
          (selection) =>
            selection.included &&
            selection.certificateTypesSnapshot.includes(certificateType)
        )
        .map((selection) => selection.id)
    );
  }

  const certificates = implementedCertificateTypes.map(
    (certificateType): CertificateProgressInput => {
      const certificate = certificateByType.get(certificateType);

      if (!certificate) {
        return {
          certificateType,
          exists: false,
          measurementCount: 0,
          measurementsComplete: false,
          overallStatus: "PENDING",
          signed: false,
        };
      }

      const expected = expectedSelectionIds(certificateType);
      const relevant = certificate.measurements.filter((measurement) =>
        expected.has(measurement.deviceSelectionId)
      );
      const config = getCertificateConfig(certificateType);
      const verification =
        certificate.layout === CertificateLayout.VERIFICATION;
      const complete = verification
        ? hasCompleteVerificationRows(certificate.verificationRows)
        : expected.size > 0 &&
          relevant.length === expected.size &&
          relevant.every((measurement) =>
            certificate.layout === CertificateLayout.TEST_READINGS
              ? hasCompleteTestReadings(
                  config.testReadingCount ?? 2,
                  measurement.readings
                )
              : hasCompleteCertificateMeasurement(
                  certificateType,
                  measurement.points
                )
          );

      return {
        certificateType,
        exists: true,
        measurementCount: verification
          ? certificate.verificationRows.length > 0
            ? 1
            : 0
          : relevant.length,
        // Cada dispositivo esperado necesita su fila, y cada fila todos sus
        // campos: una captura parcial se puede guardar, pero no está completa.
        measurementsComplete: complete,
        overallStatus: certificate.overallStatus,
        signed: certificate.signatures.length > 0,
      };
    }
  );

  return buildReportProgress({
    hasDeviceSelections: report.deviceSelections.length > 0,
    certificates,
    reportSigned: report.signatures.length > 0,
  });
}

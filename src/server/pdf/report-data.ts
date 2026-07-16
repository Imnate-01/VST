import {
  CertificateLayout,
  PointKind,
  ReportStatus,
  type CertificateType,
  type UserRole,
} from "@prisma/client";
import { prisma } from "@/server/db";
import {
  CERTIFICATE_CONFIG,
  getCertificateLabel,
  getConditionLabel,
} from "@/lib/certificates";
import { DEFAULT_LOCALE, translate, type Locale } from "@/lib/i18n";

type Actor = { id: string; role: UserRole };

function str(value: { toString(): string } | null | undefined): string | null {
  return value ? value.toString() : null;
}

function formatPdfDate(date: Date, locale: Locale): string {
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const year = String(date.getUTCFullYear()).slice(2);
  return locale === "es" ? `${day}/${month}/${year}` : `${month}/${day}/${year}`;
}

export type PdfPoint = {
  kind: PointKind;
  conditionValue: string | null;
  targetNominal: string | null;
  asFoundReference: string | null;
  asFoundReading: string | null;
  asFoundDeviation: string | null;
  asLeftReference: string | null;
  asLeftReading: string | null;
  asLeftDeviation: string | null;
};

export type PdfDeviceColumn = {
  tagNumber: string;
  description: string;
  /** Excluido del alcance: en el PDF original sus celdas van en N/A. */
  excluded: boolean;
  exclusionReason: string | null;
  status: string;
  statusReason: string | null;
  requiredAdjustment: boolean;
  points: PdfPoint[];
  readings: Array<{
    sequence: number;
    value: string | null;
    target: string | null;
    deviation: string | null;
    inTolerance: boolean | null;
  }>;
};

export type PdfSignature = {
  imageUrl: string;
  signedAt: string;
  signerName: string;
  signerTitle: string;
  /**
   * Hash del contenido firmado. Es el del payload de la firma, no el del PDF:
   * el hash del PDF no puede imprimirse dentro del propio PDF sin cambiarlo.
   */
  payloadHash: string;
};

export type PdfCertificate = {
  certificateType: CertificateType;
  layout: CertificateLayout;
  title: string;
  overallStatus: string;
  pointKinds: readonly PointKind[];
  showDeviation: boolean;
  conditionLabel: string | null;
  unit: string;
  tolerance: string;
  notes: string | null;
  params: Record<string, string>;
  standard: {
    description: string;
    manufacturer: string;
    model: string;
    serial: string;
    certNumber: string;
    calibrationDate: string;
    validTo: string;
  };
  columns: PdfDeviceColumn[];
  verificationRows: Array<{
    motorTag: string;
    description: string;
    rowLabel: string;
    scfm: string | null;
    driveFrequencyHz: string | null;
    notApplicable: boolean;
    displayOrder: number;
  }>;
  signature: PdfSignature | null;
};

export type PdfReport = {
  reportNumber: string;
  serviceDate: string;
  status: ReportStatus;
  preparedBy: { name: string; title: string; email: string };
  client: { name: string; address: string; city: string; state: string; zip: string };
  filler: { model: string; serial: string };
  observations: string | null;
  certificates: PdfCertificate[];
  signature: PdfSignature | null;
  /**
   * Fecha que se estampa en los metadatos del PDF. Se deriva del contenido (la
   * firma del reporte, o su última modificación) en vez de `new Date()`, para
   * que el mismo reporte renderice bytes idénticos y `pdfSha256` sea
   * reproducible.
   */
  documentDate: Date;
};

function toPdfSignature(signature: {
  signatureImageUrl: string;
  signedAt: Date;
  payloadHash: string;
  signer: { name: string; title: string };
} | undefined, locale: Locale): PdfSignature | null {
  if (!signature) return null;

  return {
    imageUrl: signature.signatureImageUrl,
    signedAt: formatPdfDate(signature.signedAt, locale),
    signerName: signature.signer.name,
    signerTitle: signature.signer.title,
    payloadHash: signature.payloadHash,
  };
}

/**
 * Arma el modelo de vista del PDF. Todo sale de los snapshots del reporte, no
 * del catálogo vivo: un reporte impreso hoy y dentro de un año debe decir lo
 * mismo aunque cambien las tolerancias o los instrumentos.
 */
export async function getReportForPdf(
  reportId: string,
  actor: Actor,
  locale: Locale = DEFAULT_LOCALE
): Promise<PdfReport | null> {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: {
      preparedBy: { select: { name: true, title: true, email: true } },
      filler: { include: { model: true } },
      deviceSelections: true,
      signatures: {
        where: { certificateId: null, revoked: false },
        include: { signer: { select: { name: true, title: true } } },
        orderBy: { signedAt: "desc" },
        take: 1,
      },
      certificates: {
        include: {
          primaryStandard: true,
          signatures: {
            where: { revoked: false },
            include: { signer: { select: { name: true, title: true } } },
            orderBy: { signedAt: "desc" },
            take: 1,
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
      },
    },
  });

  if (!report) return null;
  if (actor.role !== "ADMIN" && report.preparedById !== actor.id) return null;

  const certificates = report.certificates
    .sort(
      (a, b) =>
        CERTIFICATE_CONFIG[a.certificateType].pdfPage -
        CERTIFICATE_CONFIG[b.certificateType].pdfPage
    )
    .map((certificate): PdfCertificate => {
      const config = CERTIFICATE_CONFIG[certificate.certificateType];
      const measurementBySelectionId = new Map(
        certificate.measurements.map((measurement) => [
          measurement.deviceSelectionId,
          measurement,
        ])
      );

      // Todas las selecciones del certificado, incluidas las excluidas: el PDF
      // original imprime igual la columna del dispositivo, con N/A en las celdas.
      const selections = report.deviceSelections
        .filter((selection) =>
          selection.certificateTypesSnapshot.includes(certificate.certificateType)
        )
        .sort(
          (a, b) =>
            a.displayOrderSnapshot - b.displayOrderSnapshot ||
            a.tagNumberSnapshot.localeCompare(b.tagNumberSnapshot)
        );

      let columns = selections.map((selection): PdfDeviceColumn => {
        const measurement = measurementBySelectionId.get(selection.id);
        const pointByKind = new Map(
          (measurement?.points ?? []).map((point) => [point.kind, point])
        );

        return {
          tagNumber: selection.tagNumberSnapshot,
          description: selection.descriptionSnapshot,
          excluded: !selection.included,
          exclusionReason: selection.exclusionReason,
          status: measurement?.status ?? "PENDING",
          statusReason: measurement?.statusReason ?? null,
          requiredAdjustment: measurement?.requiredAdjustment ?? false,
          points: config.pointKinds.map((kind) => {
            const point = pointByKind.get(kind);

            return {
              kind,
              conditionValue: str(point?.conditionValue),
              targetNominal: str(point?.targetNominal),
              asFoundReference: str(point?.asFoundReference),
              asFoundReading: str(point?.asFoundReading),
              asFoundDeviation: str(point?.asFoundDeviation),
              asLeftReference: str(point?.asLeftReference),
              asLeftReading: str(point?.asLeftReading),
              asLeftDeviation: str(point?.asLeftDeviation),
            };
          }),
          readings: [...(measurement?.readings ?? [])]
            .sort((a, b) => a.sequence - b.sequence)
            .map((reading) => ({
              sequence: reading.sequence,
              value: str(reading.value),
              target: str(reading.target),
              deviation: str(reading.deviation),
              inTolerance: reading.inTolerance,
            })),
        };
      });
      if (certificate.layout === CertificateLayout.VERIFICATION) {
        columns = [
          {
            tagNumber: "EXHAUST",
            description: "Exhaust verification",
            excluded: false,
            exclusionReason: null,
            status:
              certificate.overallStatus === "PENDING" ? "PENDING" : "PASS",
            statusReason: null,
            requiredAdjustment: false,
            points: [],
            readings: [],
          },
        ];
      }

      const unit = selections[0]?.toleranceUnitSnapshot ?? "";
      const toleranceSelection = selections.find((selection) => selection.included) ?? selections[0];
      const tolerance = toleranceSelection
        ? `${toleranceSelection.toleranceValueSnapshot.toString()}${
            toleranceSelection.toleranceIsPercentSnapshot ? "%" : ""
          } ${unit}`.trim()
        : "";

      return {
        certificateType: certificate.certificateType,
        layout: certificate.layout,
        title: translate(locale, "certificate.suffix", {
          name: getCertificateLabel(certificate.certificateType, locale),
        }),
        overallStatus: certificate.overallStatus,
        pointKinds: config.pointKinds,
        showDeviation: config.showDeviation,
        conditionLabel: getConditionLabel(certificate.certificateType, locale),
        unit,
        tolerance,
        notes: certificate.notes,
        params:
          certificate.params &&
          typeof certificate.params === "object" &&
          !Array.isArray(certificate.params)
            ? Object.fromEntries(
                Object.entries(certificate.params).flatMap(([key, value]) =>
                  typeof value === "string" ? [[key, value]] : []
                )
              )
            : {},
        standard: {
          description: certificate.primaryStandard.descriptionSnapshot,
          manufacturer: certificate.primaryStandard.manufacturerSnapshot,
          model: certificate.primaryStandard.modelSnapshot,
          serial: certificate.primaryStandard.serialSnapshot,
          certNumber: certificate.primaryStandard.certNumberSnapshot,
          calibrationDate: formatPdfDate(certificate.primaryStandard.calDateSnapshot, locale),
          validTo: formatPdfDate(certificate.primaryStandard.calExpiresAtSnapshot, locale),
        },
        columns,
        verificationRows: [...certificate.verificationRows]
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map((row) => ({
            motorTag: row.motorTag,
            description: row.description,
            rowLabel: row.rowLabel,
            scfm: str(row.scfm),
            driveFrequencyHz: str(row.driveFrequencyHz),
            notApplicable: row.notApplicable,
            displayOrder: row.displayOrder,
          })),
        signature: toPdfSignature(certificate.signatures[0], locale),
      };
    });

  return {
    reportNumber: report.reportNumber,
    serviceDate: formatPdfDate(report.serviceDate, locale),
    status: report.status,
    preparedBy: report.preparedBy,
    client: {
      name: report.filler.clientName,
      address: report.filler.clientAddress,
      city: report.filler.clientCity,
      state: report.filler.clientState,
      zip: report.filler.clientZip,
    },
    filler: { model: report.filler.model.name, serial: report.filler.serialNumber },
    observations: report.observations,
    certificates,
    signature: toPdfSignature(report.signatures[0], locale),
    documentDate: report.signatures[0]?.signedAt ?? report.updatedAt,
  };
}

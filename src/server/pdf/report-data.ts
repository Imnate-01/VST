import {
  CertificateLayout,
  PointKind,
  ReportStatus,
  type CertificateType,
  type StandardCertificationStatus,
  type UserRole,
} from "@prisma/client";
import { Decimal } from "decimal.js";
import { prisma } from "@/server/db";
import {
  CERTIFICATE_CONFIG,
  getCertificateLabel,
  getConditionLabel,
} from "@/lib/certificates";
import { DEFAULT_LOCALE, translate, type Locale } from "@/lib/i18n";
import { resolveToleranceAbsolute } from "@/server/domain/calibration";

type Actor = { id: string; role: UserRole };

function str(value: { toString(): string } | null | undefined): string | null {
  return value ? value.toString() : null;
}

type DerivableValue = { toString(): string } | string | null | undefined;

/**
 * Calcula los valores derivados que necesita el PDF cuando un reporte histórico
 * tiene objetivo y lectura, pero no guardó deviation/inTolerance.
 */
export function derivePdfPass(params: {
  reference?: DerivableValue;
  target?: DerivableValue;
  reading?: DerivableValue;
  toleranceValue: DerivableValue;
  toleranceIsPercent: boolean;
}): { deviation: string | null; inTolerance: boolean | null } {
  const reference = params.reference ?? params.target;
  if (
    reference === null ||
    reference === undefined ||
    params.reading === null ||
    params.reading === undefined ||
    params.toleranceValue === null ||
    params.toleranceValue === undefined
  ) {
    return { deviation: null, inTolerance: null };
  }

  try {
    const referenceDecimal = new Decimal(reference.toString());
    const readingDecimal = new Decimal(params.reading.toString());
    const toleranceAbsolute = resolveToleranceAbsolute(
      referenceDecimal,
      new Decimal(params.toleranceValue.toString()),
      params.toleranceIsPercent
    );
    const deviation = readingDecimal.minus(referenceDecimal);

    return {
      deviation: deviation.toString(),
      inTolerance: deviation.abs().lte(toleranceAbsolute),
    };
  } catch {
    return { deviation: null, inTolerance: null };
  }
}

function formatPdfDate(date: Date, locale: Locale): string {
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const year = String(date.getUTCFullYear()).slice(2);
  return locale === "es" ? `${day}/${month}/${year}` : `${month}/${day}/${year}`;
}

function formatStandardCertification(
  status: StandardCertificationStatus,
  certNumber: string | null,
  calibrationDate: Date | null,
  validTo: Date | null,
  locale: Locale
) {
  if (status === "PENDING") {
    return {
      certNumber: translate(locale, "standardsAdmin.pendingCertification"),
      calibrationDate: "N/A",
      validTo: "N/A",
    };
  }
  if (status === "NOT_APPLICABLE") {
    return { certNumber: "N/A", calibrationDate: "N/A", validTo: "N/A" };
  }
  return {
    certNumber: certNumber ?? "N/A",
    calibrationDate: calibrationDate ? formatPdfDate(calibrationDate, locale) : "N/A",
    validTo: validTo ? formatPdfDate(validTo, locale) : "N/A",
  };
}

export type PdfPoint = {
  kind: PointKind;
  /** El punto no aplica al dispositivo: toda su fila se imprime en N/A. */
  notApplicable: boolean;
  conditionValue: string | null;
  targetNominal: string | null;
  asFoundReference: string | null;
  asFoundReading: string | null;
  asFoundDeviation: string | null;
  asFoundInTolerance: boolean | null;
  asLeftReference: string | null;
  asLeftReading: string | null;
  asLeftDeviation: string | null;
  asLeftInTolerance: boolean | null;
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
  notes: string | null;
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

/**
 * Un patrón del reporte con los certificados donde se usó. La trazabilidad se
 * arma sobre esta lista, no sobre el patrón de cada certificado: dos secciones
 * pueden compartir instrumento y la tabla debe seguir nombrando a las dos.
 */
export type PdfStandard = {
  description: string;
  manufacturer: string;
  model: string;
  serial: string;
  certNumber: string;
  calibrationDate: string;
  validTo: string;
  usedIn: string[];
};

/** Patrón tal como se imprime en el bloque de validación de un certificado. */
export type PdfCertificateStandard = {
  description: string;
  manufacturer: string;
  model: string;
  serial: string;
  certNumber: string;
  calibrationDate: string;
  validTo: string;
};

/** Fila del checklist de dispositivos, tal como se guardó al armar el reporte. */
export type PdfChecklistRow = {
  tagNumber: string;
  description: string;
  deviceType: string;
  tolerance: string;
  certificates: string[];
  included: boolean;
  exclusionReason: string | null;
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
  params: Record<string, string>;
  /**
   * Patrones que respaldan la sección, el principal primero. La plantilla
   * imprime un bloque de validación por instrumento: la báscula y el peso
   * patrón de las bombas son dos.
   */
  standards: PdfCertificateStandard[];
  columns: PdfDeviceColumn[];
  verificationRows: Array<{
    motorTag: string;
    description: string;
    rowLabel: string;
    scfm: string | null;
    driveFrequencyHz: string | null;
    notApplicable: boolean;
    displayOrder: number;
    notes: string | null;
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
  /** Todos los patrones usados en el reporte, en el orden de las páginas. */
  standards: PdfStandard[];
  checklist: PdfChecklistRow[];
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
      standards: true,
      signatures: {
        where: { certificateId: null, revoked: false },
        include: { signer: { select: { name: true, title: true } } },
        orderBy: { signedAt: "desc" },
        take: 1,
      },
      certificates: {
        include: {
          primaryStandard: true,
          additionalStandards: {
            include: { reportStandard: true },
            orderBy: { displayOrder: "asc" },
          },
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
          notes: measurement?.notes ?? null,
          points: config.pointKinds.map((kind) => {
            const point = pointByKind.get(kind);
            const asFound = derivePdfPass({
              reference: point?.asFoundReference,
              target: point?.targetNominal,
              reading: point?.asFoundReading,
              toleranceValue: selection.toleranceValueSnapshot,
              toleranceIsPercent: selection.toleranceIsPercentSnapshot,
            });
            const asLeft = derivePdfPass({
              reference: point?.asLeftReference,
              target: point?.targetNominal,
              reading: point?.asLeftReading,
              toleranceValue: selection.toleranceValueSnapshot,
              toleranceIsPercent: selection.toleranceIsPercentSnapshot,
            });

            return {
              kind,
              notApplicable: point?.notApplicable ?? false,
              conditionValue: str(point?.conditionValue),
              targetNominal: str(point?.targetNominal),
              asFoundReference: str(point?.asFoundReference),
              asFoundReading: str(point?.asFoundReading),
              asFoundDeviation:
                str(point?.asFoundDeviation) ?? asFound.deviation,
              asFoundInTolerance:
                point?.asFoundInTolerance ?? asFound.inTolerance,
              asLeftReference: str(point?.asLeftReference),
              asLeftReading: str(point?.asLeftReading),
              asLeftDeviation:
                str(point?.asLeftDeviation) ?? asLeft.deviation,
              asLeftInTolerance:
                point?.asLeftInTolerance ?? asLeft.inTolerance,
            };
          }),
          readings: [...(measurement?.readings ?? [])]
            .sort((a, b) => a.sequence - b.sequence)
            .map((reading) => {
              const evaluated = derivePdfPass({
                reference: reading.target,
                reading: reading.value,
                toleranceValue: selection.toleranceValueSnapshot,
                toleranceIsPercent: selection.toleranceIsPercentSnapshot,
              });

              return {
                sequence: reading.sequence,
                value: str(reading.value),
                target: str(reading.target),
                deviation: str(reading.deviation) ?? evaluated.deviation,
                inTolerance:
                  reading.inTolerance ?? evaluated.inTolerance,
              };
            }),
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
            notes: null,
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
      // El principal primero y después los complementarios, en el orden en que
      // se declararon: la báscula antes que el peso que la verifica.
      const certificateStandards: PdfCertificateStandard[] = [
        certificate.primaryStandard,
        ...certificate.additionalStandards.map((link) => link.reportStandard),
      ].map((standard) => ({
        description: standard.descriptionSnapshot,
        manufacturer: standard.manufacturerSnapshot,
        model: standard.modelSnapshot,
        serial: standard.serialSnapshot,
        ...formatStandardCertification(
          standard.certificationStatusSnapshot,
          standard.certNumberSnapshot,
          standard.calDateSnapshot,
          standard.calExpiresAtSnapshot,
          locale
        ),
      }));

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
        standards: certificateStandards,
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
            notes: row.notes,
          })),
        signature: toPdfSignature(certificate.signatures[0], locale),
      };
    });

  // Los certificados que usó cada patrón, en el orden de las páginas del PDF.
  const certificatesByStandardId = new Map<string, string[]>();
  const pageByStandardId = new Map<string, number>();
  for (const certificate of [...report.certificates].sort(
    (a, b) =>
      CERTIFICATE_CONFIG[a.certificateType].pdfPage -
      CERTIFICATE_CONFIG[b.certificateType].pdfPage
  )) {
    const label = getCertificateLabel(certificate.certificateType, locale);
    const page = CERTIFICATE_CONFIG[certificate.certificateType].pdfPage;
    // El complementario es tan trazable como el principal: si el peso patrón
    // verificó la báscula, la tabla tiene que declararlo.
    const standardIds = [
      certificate.primaryStandardId,
      ...certificate.additionalStandards.map((link) => link.reportStandardId),
    ];

    for (const standardId of standardIds) {
      const used = certificatesByStandardId.get(standardId);
      if (used) {
        if (!used.includes(label)) used.push(label);
      } else {
        certificatesByStandardId.set(standardId, [label]);
        pageByStandardId.set(standardId, page);
      }
    }
  }

  const standards: PdfStandard[] = report.standards
    // Un patrón queda registrado en el reporte aunque después se cambie el
    // instrumento de esa sección. La trazabilidad solo declara los que
    // efectivamente respaldan un certificado.
    .filter((standard) => certificatesByStandardId.has(standard.id))
    .sort(
      (a, b) =>
        (pageByStandardId.get(a.id) ?? 0) - (pageByStandardId.get(b.id) ?? 0)
    )
    .map((standard) => {
      const certification = formatStandardCertification(
        standard.certificationStatusSnapshot,
        standard.certNumberSnapshot,
        standard.calDateSnapshot,
        standard.calExpiresAtSnapshot,
        locale
      );
      return {
        description: standard.descriptionSnapshot,
        manufacturer: standard.manufacturerSnapshot,
        model: standard.modelSnapshot,
        serial: standard.serialSnapshot,
        ...certification,
        usedIn: certificatesByStandardId.get(standard.id) ?? [],
      };
    });

  // `displayOrderSnapshot` ordena las columnas dentro de un certificado y
  // reinicia en cada uno, así que por sí solo intercalaría dispositivos de
  // secciones distintas. El checklist agrupa primero por la sección donde se
  // calibra, para que se lea en el mismo orden que las páginas que le siguen.
  const checklistSection = (types: CertificateType[]) =>
    types.length === 0
      ? Number.MAX_SAFE_INTEGER
      : Math.min(...types.map((type) => CERTIFICATE_CONFIG[type].pdfPage));

  const checklist: PdfChecklistRow[] = [...report.deviceSelections]
    .sort(
      (a, b) =>
        checklistSection(a.certificateTypesSnapshot) -
          checklistSection(b.certificateTypesSnapshot) ||
        a.displayOrderSnapshot - b.displayOrderSnapshot ||
        a.tagNumberSnapshot.localeCompare(b.tagNumberSnapshot)
    )
    .map((selection) => ({
      tagNumber: selection.tagNumberSnapshot,
      description: selection.descriptionSnapshot,
      deviceType: selection.deviceTypeSnapshot,
      tolerance: `${selection.toleranceValueSnapshot.toString()}${
        selection.toleranceIsPercentSnapshot ? "%" : ""
      } ${selection.toleranceUnitSnapshot}`.trim(),
      certificates: selection.certificateTypesSnapshot.map((type) =>
        getCertificateLabel(type, locale)
      ),
      included: selection.included,
      exclusionReason: selection.exclusionReason,
    }));

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
    standards,
    checklist,
    signature: toPdfSignature(report.signatures[0], locale),
    documentDate: report.signatures[0]?.signedAt ?? report.updatedAt,
  };
}

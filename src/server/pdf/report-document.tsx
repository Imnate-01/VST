import React from "react";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { PointKind } from "@prisma/client";
import { SigLogo } from "./sig-logo";
import type { PdfCertificate, PdfDeviceColumn, PdfReport, PdfSignature } from "./report-data";
import {
  createTranslator,
  DEFAULT_LOCALE,
  translate,
  type Locale,
  type MessageKey,
} from "@/lib/i18n";

/**
 * PDF-safe equivalents of the product design system.
 * Helvetica is the stable sans-serif stand-in and Courier is reserved for
 * report IDs, serials, dates, and measurement values.
 */
const BRAND = "#145EFC";
const BRAND_SOFT = "#EAF1FF";
const BLACK = "#000000";
const SAND_1 = "#F2EFEB";
const SAND_2 = "#E5DFD9";
const SAND_3 = "#BFBAB5";
const SAND_4 = "#73706D";
const WHITE = "#FFFFFF";

const PASS = "#1F7A4D";
const PASS_BG = "#EDF7F1";
const FAIL = "#B42318";
const FAIL_BG = "#FCEEEE";
const NEUTRAL = SAND_4;
const NEUTRAL_BG = SAND_1;

const styles = StyleSheet.create({
  page: {
    paddingTop: 26,
    paddingBottom: 44,
    paddingHorizontal: 32,
    fontSize: 8.2,
    fontFamily: "Helvetica",
    color: BLACK,
    backgroundColor: WHITE,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: SAND_2,
    marginBottom: 18,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 9 },
  logoBox: {
    width: 31,
    height: 31,
    borderWidth: 1,
    borderColor: SAND_3,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: BLACK },
  headerSub: {
    marginTop: 2,
    fontSize: 6.2,
    fontFamily: "Courier-Bold",
    color: SAND_4,
    letterSpacing: 0.5,
  },
  headerRight: { alignItems: "flex-end" },
  headerMeta: {
    fontSize: 6,
    fontFamily: "Courier-Bold",
    color: SAND_4,
    textTransform: "uppercase",
  },
  headerRef: {
    marginTop: 2,
    fontSize: 8.2,
    fontFamily: "Courier-Bold",
    color: BLACK,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  },
  docTitle: { fontSize: 20, fontFamily: "Helvetica-Bold", color: BLACK },
  docLead: {
    maxWidth: 440,
    fontSize: 7.5,
    lineHeight: 1.5,
    color: SAND_4,
    marginTop: 5,
    marginBottom: 16,
  },
  certTitle: { fontSize: 16, fontFamily: "Helvetica-Bold", color: BLACK },
  certLead: {
    fontSize: 7,
    lineHeight: 1.5,
    color: SAND_4,
    marginTop: 4,
    marginBottom: 12,
  },
  coverEyebrow: {
    marginBottom: 6,
    fontSize: 6.5,
    fontFamily: "Courier",
    color: SAND_4,
    letterSpacing: 0.8,
  },
  coverSubtitle: {
    marginTop: 4,
    marginBottom: 15,
    fontSize: 8,
    color: SAND_4,
  },
  sectionTitle: {
    marginTop: 13,
    marginBottom: 7,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: BLACK,
  },
  sectionBar: {
    backgroundColor: SAND_1,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: SAND_2,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
  },
  sectionBarText: {
    fontSize: 6.5,
    fontFamily: "Courier-Bold",
    color: SAND_4,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  table: {
    borderWidth: 1,
    borderColor: SAND_2,
    borderTopWidth: 0,
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 5,
  },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: SAND_2 },
  rowLast: { flexDirection: "row" },
  rowZebra: { backgroundColor: "#FBFAF9" },
  labelCell: {
    width: 118,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderRightColor: SAND_2,
    backgroundColor: SAND_1,
    fontFamily: "Helvetica-Bold",
    fontSize: 6.8,
    color: BLACK,
  },
  valueCell: { flex: 1, paddingVertical: 4, paddingHorizontal: 6, fontSize: 7.5 },
  dataCell: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRightWidth: 1,
    borderRightColor: SAND_2,
    textAlign: "center",
    fontFamily: "Courier",
    fontSize: 7,
  },
  dataCellLast: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 4,
    textAlign: "center",
    fontFamily: "Courier",
    fontSize: 7,
  },
  groupRow: { backgroundColor: BRAND_SOFT },
  groupLabel: {
    width: 118,
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderRightColor: SAND_2,
    fontFamily: "Courier-Bold",
    fontSize: 6.5,
    color: BRAND,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  subRow: { backgroundColor: SAND_1 },
  subLabel: {
    width: 118,
    paddingVertical: 2,
    paddingHorizontal: 10,
    borderRightWidth: 1,
    borderRightColor: SAND_2,
    fontFamily: "Courier-Bold",
    fontSize: 6,
    color: SAND_4,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  excluded: { color: SAND_3 },
  identity: { fontFamily: "Courier-Bold", color: BLACK },
  twoCol: { flexDirection: "row", gap: 14, marginTop: 14 },
  col: { flex: 1 },
  signatureBox: {
    borderWidth: 1,
    borderColor: SAND_2,
    borderRadius: 5,
    backgroundColor: WHITE,
    height: 54,
    padding: 3,
    justifyContent: "center",
  },
  signatureImage: { height: 46, objectFit: "contain" },
  caption: { fontSize: 6.3, color: SAND_4, marginTop: 3 },
  unsigned: { fontSize: 7, color: SAND_3, textAlign: "center" },
  observations: {
    borderWidth: 1,
    borderColor: SAND_2,
    borderRadius: 5,
    minHeight: 54,
    padding: 6,
    fontSize: 7.5,
    lineHeight: 1.4,
    backgroundColor: SAND_1,
  },
  blockLabel: {
    fontSize: 6.5,
    fontFamily: "Courier-Bold",
    color: SAND_4,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  chip: {
    alignSelf: "flex-start",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 5,
    fontSize: 6.5,
    fontFamily: "Courier-Bold",
    letterSpacing: 0.3,
  },
  summaryCard: {
    borderWidth: 1,
    borderColor: SAND_2,
    borderRadius: 6,
    marginBottom: 14,
    overflow: "hidden",
  },
  summaryRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: SAND_2,
  },
  summaryRowLast: { flexDirection: "row" },
  summaryCell: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  summaryCellBorder: {
    borderRightWidth: 1,
    borderRightColor: SAND_2,
  },
  summaryLabel: {
    fontSize: 5.8,
    fontFamily: "Courier-Bold",
    color: SAND_4,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: BLACK,
  },
  summaryTechnical: {
    fontFamily: "Courier-Bold",
    fontSize: 7.8,
  },
  resultGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  resultCard: {
    width: "31.9%",
    minHeight: 58,
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  resultName: {
    fontSize: 6.8,
    fontFamily: "Helvetica-Bold",
    marginBottom: 5,
  },
  resultCount: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  resultMeta: { fontSize: 6.5, color: SAND_4 },
  alert: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 7,
    lineHeight: 1.45,
  },
  alertTitle: { fontFamily: "Helvetica-Bold" },
  traceTable: {
    borderWidth: 1,
    borderColor: SAND_2,
  },
  traceHeader: {
    flexDirection: "row",
    backgroundColor: SAND_1,
    borderBottomWidth: 1,
    borderBottomColor: SAND_2,
  },
  traceRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: SAND_2,
  },
  traceRowLast: { flexDirection: "row" },
  traceHeadCell: {
    paddingVertical: 5,
    paddingHorizontal: 7,
    fontSize: 5.8,
    fontFamily: "Courier-Bold",
    color: SAND_4,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  traceCell: {
    paddingVertical: 5,
    paddingHorizontal: 7,
    fontSize: 6.7,
  },
  traceTechnical: { fontFamily: "Courier", fontSize: 6.4 },
  certificateAlert: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#EDB6B1",
    borderRadius: 6,
    backgroundColor: FAIL_BG,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 7,
    lineHeight: 1.45,
    color: BLACK,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 32,
    right: 32,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: SAND_2,
    flexDirection: "row",
    justifyContent: "space-between",
    fontFamily: "Courier",
    fontSize: 6,
    color: SAND_4,
  },
});

const NA = "N/A";
const EMPTY = "-";

function statusChipStyle(status: string) {
  if (status === "PASS") return { color: PASS, backgroundColor: PASS_BG };
  if (status === "FAIL") return { color: FAIL, backgroundColor: FAIL_BG };
  if (status === "MIXED") return { color: "#B54708", backgroundColor: "#FEF0C7" };
  return { color: NEUTRAL, backgroundColor: NEUTRAL_BG };
}

function Field({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={last ? styles.rowLast : styles.row}>
      <Text style={styles.labelCell}>{label}</Text>
      <Text style={styles.valueCell}>{value}</Text>
    </View>
  );
}

function SummaryCell({
  label,
  value,
  border,
  technical,
}: {
  label: string;
  value: string;
  border?: boolean;
  technical?: boolean;
}) {
  return (
    <View style={[styles.summaryCell, border ? styles.summaryCellBorder : {}]}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, technical ? styles.summaryTechnical : {}]}>
        {value}
      </Text>
    </View>
  );
}

function SectionBar({ children }: { children: string }) {
  return (
    <View style={styles.sectionBar}>
      <Text style={styles.sectionBarText}>{children}</Text>
    </View>
  );
}

function BrandHeader({
  report,
  locale,
}: {
  report: PdfReport;
  locale: Locale;
}) {
  const t = createTranslator(locale);
  return (
    <View style={styles.header} fixed>
      <View style={styles.headerLeft}>
        <View style={styles.logoBox}>
          <SigLogo width={24} />
        </View>
        <View>
          <Text style={styles.headerTitle}>Calibration Report</Text>
          <Text style={styles.headerSub}>Vapor Sterilant Technology</Text>
        </View>
      </View>
      <View style={styles.headerRight}>
        <Text style={styles.headerMeta}>{t("pdf.report")}</Text>
        <Text style={styles.headerRef}>{report.reportNumber}</Text>
      </View>
    </View>
  );
}

function SignatureSlot({
  signature,
  label,
  locale,
}: {
  signature: PdfSignature | null;
  label: string;
  locale: Locale;
}) {
  const t = createTranslator(locale);
  return (
    <View>
      <Text style={styles.blockLabel}>{label}</Text>
      <View style={styles.signatureBox}>
        {signature ? (
          // El Image de @react-pdf/renderer dibuja en el PDF, no es un <img>: no admite alt.
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={signature.imageUrl} style={styles.signatureImage} />
        ) : (
          <Text style={styles.unsigned}>{t("pdf.notSigned")}</Text>
        )}
      </View>
      <Text style={styles.caption}>
        {signature
          ? `${signature.signerName} - ${signature.signerTitle} - ${signature.signedAt}`
          : t("pdf.pendingValidation")}
      </Text>
    </View>
  );
}

function Footer({ report, locale }: { report: PdfReport; locale: Locale }) {
  const t = createTranslator(locale);
  return (
    <View style={styles.footer} fixed>
      <Text>{t("pdf.confidential")}</Text>
      <Text
        render={({ pageNumber, totalPages }) =>
          `${t("pdf.generated", { date: report.serviceDate })} - ${t("pdf.pageOf", {
            page: pageNumber,
            total: totalPages,
          })}`
        }
      />
    </View>
  );
}

function CoverPage({ report, locale }: { report: PdfReport; locale: Locale }) {
  const t = createTranslator(locale);
  const hasDeviation = report.certificates.some(
    (certificate) =>
      certificate.overallStatus === "FAIL" ||
      certificate.overallStatus === "MIXED" ||
      certificate.columns.some((column) => column.status === "FAIL")
  );
  const standards = Array.from(
    new Map(
      report.certificates.map((certificate) => [
        certificate.standard.serial,
        certificate.standard,
      ])
    ).values()
  );
  const certificateSummary = report.certificates.map((certificate) => {
    const channels = certificate.columns.filter((column) => !column.excluded);
    return {
      certificate,
      pass: channels.filter((column) => column.status === "PASS").length,
      total: channels.length,
    };
  });
  const certificateNames = report.certificates
    .map((certificate) =>
      certificate.title
        .replace(" Calibration Certificate", "")
        .replace(" Certificado de calibración", "")
    )
    .join(" - ");

  return (
    <Page size="LETTER" style={styles.page}>
      <BrandHeader report={report} locale={locale} />

      <Text style={styles.coverEyebrow}>{t("pdf.certificateOfCalibration")}</Text>
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.docTitle}>
            {t("pdf.asepticFillerTitle", { model: report.filler.model })}
          </Text>
          <Text style={styles.coverSubtitle}>{certificateNames}</Text>
        </View>
        <Text
          style={[
            styles.chip,
            hasDeviation
              ? { color: FAIL, backgroundColor: FAIL_BG }
              : { color: PASS, backgroundColor: PASS_BG },
          ]}
        >
          {hasDeviation ? t("pdf.deviationRecorded") : t("pdf.calibrationComplete")}
        </Text>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <SummaryCell
            label={t("pdf.reportNumber")}
            value={report.reportNumber}
            border
            technical
          />
          <SummaryCell
            label={t("pdf.client")}
            value={`${report.client.name} - ${report.client.city}`}
            border
          />
          <SummaryCell label={t("pdf.serviceDate")} value={report.serviceDate} technical />
        </View>
        <View style={styles.summaryRowLast}>
          <SummaryCell
            label={t("pdf.fillerModel")}
            value={`${report.filler.model}\nSN ${report.filler.serial}`}
            border
          />
          <SummaryCell
            label={t("pdf.plantLine")}
            value={`${report.client.city} / ${report.client.state}`}
            border
          />
          <SummaryCell
            label={t("pdf.serviceEngineer")}
            value={`${report.preparedBy.name}\n${report.preparedBy.title}`}
          />
        </View>
      </View>

      <Text style={styles.sectionTitle}>{t("pdf.summaryResults")}</Text>
      <View style={styles.resultGrid}>
        {certificateSummary.map(({ certificate, pass, total }) => {
          const failed =
            certificate.overallStatus === "FAIL" || certificate.overallStatus === "MIXED";
          const tone = failed
            ? { color: FAIL, borderColor: "#EDB6B1", backgroundColor: FAIL_BG }
            : { color: PASS, borderColor: "#A9D7BC", backgroundColor: PASS_BG };
          return (
            <View key={certificate.certificateType} style={[styles.resultCard, tone]}>
              <Text style={styles.resultName}>
                {certificate.title
                  .replace(" Calibration Certificate", "")
                  .replace(" Certificado de calibración", "")}
              </Text>
              <Text style={styles.resultCount}>
                {t("pdf.passCount", { pass, total })}
              </Text>
              <Text style={styles.resultMeta}>
                {t("pdf.toleranceLabel", { tolerance: certificate.tolerance || "-" })}
              </Text>
            </View>
          );
        })}
      </View>

      <Text
        style={[
          styles.alert,
          hasDeviation
            ? { borderColor: "#EDB6B1", backgroundColor: FAIL_BG, color: FAIL }
            : { borderColor: "#A9D7BC", backgroundColor: PASS_BG, color: PASS },
        ]}
      >
        <Text style={styles.alertTitle}>
          {hasDeviation ? `${t("pdf.deviationRecorded")}. ` : `${t("pdf.calibrationComplete")}. `}
        </Text>
        {hasDeviation ? t("pdf.overallDeviation") : t("pdf.overallComplete")}
      </Text>

      <Text style={styles.sectionTitle}>{t("pdf.referenceTraceability")}</Text>
      <View style={styles.traceTable}>
        <View style={styles.traceHeader}>
          <Text style={[styles.traceHeadCell, { width: "45%" }]}>{t("pdf.standard")}</Text>
          <Text style={[styles.traceHeadCell, { width: "18%" }]}>{t("pdf.serial")}</Text>
          <Text style={[styles.traceHeadCell, { width: "20%" }]}>{t("pdf.certificate")}</Text>
          <Text style={[styles.traceHeadCell, { width: "17%" }]}>{t("pdf.validTo")}</Text>
        </View>
        {standards.map((standard, index) => (
          <View
            key={standard.serial}
            style={index === standards.length - 1 ? styles.traceRowLast : styles.traceRow}
          >
            <Text style={[styles.traceCell, { width: "45%" }]}>
              {standard.description} - {standard.manufacturer} {standard.model}
            </Text>
            <Text style={[styles.traceCell, styles.traceTechnical, { width: "18%" }]}>
              {standard.serial}
            </Text>
            <Text style={[styles.traceCell, styles.traceTechnical, { width: "20%" }]}>
              {standard.certNumber}
            </Text>
            <Text style={[styles.traceCell, styles.traceTechnical, { width: "17%" }]}>
              {standard.validTo}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.twoCol}>
        <View style={styles.col}>
          <Text style={styles.blockLabel}>{t("pdf.observations")}</Text>
          <Text style={styles.observations}>{report.observations ?? EMPTY}</Text>
        </View>
        <View style={styles.col}>
          <SignatureSlot signature={report.signature} label={t("pdf.signOff")} locale={locale} />
        </View>
      </View>

      <Footer report={report} locale={locale} />
    </Page>
  );
}

function pointLabel(kind: PointKind, locale: Locale): string {
  if (kind === PointKind.LOW) return translate(locale, "pdf.lowReference");
  if (kind === PointKind.HIGH) return translate(locale, "pdf.highReference");
  return translate(locale, "pdf.verification");
}

const pdfDataLabelKeys: Record<string, MessageKey> = {
  "Tag Number": "pdf.tagNumber",
  Description: "pdf.description",
  "Target reference (nominal)": "pdf.targetReference",
  "Actual reference": "pdf.actualReference",
  "UUT reading (As Found)": "pdf.uutAsFound",
  "UUT reading (As Left)": "pdf.uutAsLeft",
  Deviation: "pdf.deviation",
};

function DataRow({
  label,
  columns,
  pick,
  zebra,
  strong,
  locale,
  /**
   * Filas de identificación (tag, descripción). Un dispositivo excluido igual
   * aparece en el certificado: el N/A va en sus celdas de medición, no en su
   * nombre. Es lo que hace el reporte original con los RTD 1605 y 1607.
   *
   * Es una regla de contenido, no de estilo: el resaltado va en `strong`.
   */
  identity,
}: {
  label: string;
  columns: PdfDeviceColumn[];
  pick: (column: PdfDeviceColumn) => string | null;
  zebra?: boolean;
  strong?: boolean;
  identity?: boolean;
  locale: Locale;
}) {
  const translatedLabel = pdfDataLabelKeys[label]
    ? translate(locale, pdfDataLabelKeys[label])
    : label;
  return (
    <View style={[styles.row, zebra ? styles.rowZebra : {}]}>
      <Text style={styles.labelCell}>{translatedLabel}</Text>
      {columns.map((column, index) => (
        <Text
          key={column.tagNumber}
          style={[
            index === columns.length - 1 ? styles.dataCellLast : styles.dataCell,
            strong ? styles.identity : {},
            column.excluded ? styles.excluded : {},
          ]}
        >
          {column.excluded && !identity ? NA : (pick(column) ?? EMPTY)}
        </Text>
      ))}
    </View>
  );
}

function GroupHeader({ label, span }: { label: string; span: number }) {
  return (
    <View style={[styles.row, styles.groupRow]}>
      <Text style={styles.groupLabel}>{label}</Text>
      {Array.from({ length: span }).map((_, index) => (
        <Text
          key={index}
          style={index === span - 1 ? styles.dataCellLast : styles.dataCell}
        >
          {" "}
        </Text>
      ))}
    </View>
  );
}

/** Subencabezado As Found / As Left dentro de un grupo de punto. */
function SubHeader({ label, span }: { label: string; span: number }) {
  return (
    <View style={[styles.row, styles.subRow]}>
      <Text style={styles.subLabel}>{label}</Text>
      {Array.from({ length: span }).map((_, index) => (
        <Text
          key={index}
          style={index === span - 1 ? styles.dataCellLast : styles.dataCell}
        >
          {" "}
        </Text>
      ))}
    </View>
  );
}

function CertificatePage({
  report,
  certificate,
  locale,
}: {
  report: PdfReport;
  certificate: PdfCertificate;
  locale: Locale;
}) {
  const t = createTranslator(locale);
  const { columns } = certificate;
  const span = columns.length;
  const evaluatedColumns = columns.filter((column) => !column.excluded);
  const passCount = evaluatedColumns.filter((column) => column.status === "PASS").length;
  const issues = [
    certificate.notes,
    ...columns
      .filter((column) => column.status === "FAIL")
      .map(
        (column) =>
          column.statusReason ||
          `${column.tagNumber} ${column.description}: ${translate(locale, "pdf.deviationRecorded")}`
      ),
  ].filter((issue): issue is string => Boolean(issue));
  const pointOf = (column: PdfDeviceColumn, kind: PointKind) =>
    column.points.find((point) => point.kind === kind) ?? null;

  return (
    <Page size="LETTER" style={styles.page}>
      <BrandHeader report={report} locale={locale} />

      <View style={styles.titleRow}>
        <Text style={styles.certTitle}>{certificate.title}</Text>
        <Text style={[styles.chip, statusChipStyle(certificate.overallStatus)]}>
          {certificate.overallStatus === "PASS"
            ? `${t("measurement.pass")} - ${passCount}/${evaluatedColumns.length}`
            : certificate.overallStatus === "FAIL"
              ? `${t("measurement.fail")} - ${passCount}/${evaluatedColumns.length}`
              : certificate.overallStatus === "MIXED"
                ? `${t("measurement.mixed")} - ${passCount}/${evaluatedColumns.length}`
                : t("measurement.pending")}
        </Text>
      </View>
      <Text style={styles.certLead}>
        {t("pdf.instructions")}
      </Text>

      <SectionBar>{t("pdf.devicesUnit", { unit: certificate.unit })}</SectionBar>
      <View style={styles.table}>
        <DataRow
          label="Tag Number"
          locale={locale}
          columns={columns}
          pick={(c) => c.tagNumber}
          identity
          strong
        />
        <DataRow
          label="Description"
          locale={locale}
          columns={columns}
          pick={(c) => c.description}
          zebra
          identity
        />

        {certificate.pointKinds.map((kind) => (
          <React.Fragment key={kind}>
            <GroupHeader label={pointLabel(kind, locale)} span={span} />
            {certificate.conditionLabel && (
              <DataRow
                label={certificate.conditionLabel}
                locale={locale}
                columns={columns}
                pick={(c) => pointOf(c, kind)?.conditionValue ?? null}
              />
            )}
            <DataRow
              label="Target reference (nominal)"
              locale={locale}
              columns={columns}
              pick={(c) => pointOf(c, kind)?.targetNominal ?? null}
            />

            <SubHeader label={t("pdf.asFound")} span={span} />
            <DataRow
              label="Actual reference"
              locale={locale}
              columns={columns}
              pick={(c) => pointOf(c, kind)?.asFoundReference ?? null}
            />
            <DataRow
              label="UUT reading (As Found)"
              locale={locale}
              columns={columns}
              pick={(c) => pointOf(c, kind)?.asFoundReading ?? null}
              zebra
            />
            {certificate.showDeviation && (
              <DataRow
                label="Deviation"
                locale={locale}
                columns={columns}
                pick={(c) => pointOf(c, kind)?.asFoundDeviation ?? null}
              />
            )}

            <SubHeader label={t("pdf.asLeft")} span={span} />
            <DataRow
              label="Actual reference"
              locale={locale}
              columns={columns}
              pick={(c) => pointOf(c, kind)?.asLeftReference ?? null}
            />
            <DataRow
              label="UUT reading (As Left)"
              locale={locale}
              columns={columns}
              pick={(c) => pointOf(c, kind)?.asLeftReading ?? null}
              zebra
            />
            {certificate.showDeviation && (
              <DataRow
                label="Deviation"
                locale={locale}
                columns={columns}
                pick={(c) => pointOf(c, kind)?.asLeftDeviation ?? null}
              />
            )}
          </React.Fragment>
        ))}
      </View>

      {issues.length > 0 && (
        <Text style={styles.certificateAlert}>
          <Text style={[styles.alertTitle, { color: FAIL }]}>
            {t("pdf.observation")}.{" "}
          </Text>
          {issues.join(" ")}
        </Text>
      )}

      <View style={styles.twoCol}>
        <View style={styles.col}>
          <SectionBar>{t("pdf.standardValidation")}</SectionBar>
          <View style={styles.table}>
            <Field label={t("pdf.deviceDescription")} value={certificate.standard.description} />
            <Field label={t("pdf.manufacturer")} value={certificate.standard.manufacturer} />
            <Field label={t("pdf.model")} value={certificate.standard.model} />
            <Field label={t("pdf.serial")} value={certificate.standard.serial} />
            <Field label={t("pdf.calibrationCertificate")} value={certificate.standard.certNumber} />
            <Field
              label={t("pdf.calibrationDate")}
              value={certificate.standard.calibrationDate}
            />
            <Field
              label={t("pdf.validTo")}
              value={certificate.standard.validTo}
              last
            />
          </View>
        </View>
        <View style={styles.col}>
          <SignatureSlot
            signature={certificate.signature}
            label={t("pdf.signatureDate")}
            locale={locale}
          />
        </View>
      </View>

      <Footer report={report} locale={locale} />
    </Page>
  );
}

export function ReportDocument({
  report,
  locale = DEFAULT_LOCALE,
}: {
  report: PdfReport;
  locale?: Locale;
}) {
  return (
    <Document
      title={report.reportNumber}
      author={report.preparedBy.name}
      subject={translate(locale, "pdf.fieldServiceReport")}
      creationDate={report.documentDate}
      modificationDate={report.documentDate}
    >
      <CoverPage report={report} locale={locale} />
      {report.certificates.map((certificate) => (
        <CertificatePage
          key={certificate.certificateType}
          report={report}
          certificate={certificate}
          locale={locale}
        />
      ))}
    </Document>
  );
}

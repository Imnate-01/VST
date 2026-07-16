import React from "react";
import {
  Circle,
  Document,
  Image,
  Page,
  Path,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";
import { CertificateLayout, PointKind } from "@prisma/client";
import { SigLogo } from "./sig-logo";
import type { PdfCertificate, PdfDeviceColumn, PdfReport, PdfSignature } from "./report-data";
import {
  certificateOutcome,
  countChannels,
  evaluatedColumns,
  reportOutcome,
  type Outcome,
} from "@/server/domain/report-outcome";
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

const TABLE_HEAD = "#F7F5F2";
const ZEBRA = "#FBFAF8";

const PASS = "#1F7A4D";
const PASS_BG = "#F1F7F3";
const PASS_BORDER = "#BEDCC9";
const FAIL = "#B42318";
const FAIL_BG = "#FBF0EF";
const FAIL_BORDER = "#EDC4BF";
const NEUTRAL = SAND_4;
const NEUTRAL_BG = SAND_1;

/**
 * Verde solo cuando todo se evaluó y pasó. Un reporte a medias se pinta neutro,
 * nunca como aprobado.
 */
const OUTCOME_TONE: Record<Outcome, { color: string; bg: string; border: string }> = {
  pass: { color: PASS, bg: PASS_BG, border: PASS_BORDER },
  deviation: { color: FAIL, bg: FAIL_BG, border: FAIL_BORDER },
  incomplete: { color: NEUTRAL, bg: NEUTRAL_BG, border: SAND_3 },
};

const outcomeLabelKeys: Record<Outcome, MessageKey> = {
  pass: "pdf.calibrationComplete",
  deviation: "pdf.deviationRecorded",
  incomplete: "pdf.calibrationIncomplete",
};

const outcomeBodyKeys: Record<Outcome, MessageKey> = {
  pass: "pdf.overallComplete",
  deviation: "pdf.overallDeviation",
  incomplete: "pdf.overallIncomplete",
};

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
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: SAND_2,
    marginBottom: 10,
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
  docTitle: { fontSize: 18, fontFamily: "Helvetica-Bold", color: BLACK },
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
    marginBottom: 8,
  },
  coverEyebrow: {
    marginBottom: 6,
    fontSize: 6.5,
    fontFamily: "Courier",
    color: SAND_4,
    letterSpacing: 0.8,
  },
  coverSubtitle: {
    marginTop: 2,
    marginBottom: 9,
    fontSize: 8,
    color: SAND_4,
  },
  sectionTitle: {
    marginTop: 9,
    marginBottom: 5,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: BLACK,
  },
  sectionBar: {
    backgroundColor: TABLE_HEAD,
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
  rowZebra: { backgroundColor: ZEBRA },
  labelCell: {
    width: 118,
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderRightColor: SAND_2,
    backgroundColor: TABLE_HEAD,
    fontFamily: "Helvetica-Bold",
    fontSize: 6.8,
    color: BLACK,
  },
  valueCell: { flex: 1, paddingVertical: 3, paddingHorizontal: 6, fontSize: 7.5 },
  dataCell: {
    flex: 1,
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderRightWidth: 1,
    borderRightColor: SAND_2,
    textAlign: "center",
    fontFamily: "Courier",
    fontSize: 7,
  },
  dataCellLast: {
    flex: 1,
    paddingVertical: 3,
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
  threeCol: { flexDirection: "row", gap: 12, marginTop: 8 },
  col: { flex: 1 },
  signatureBox: {
    borderWidth: 1,
    borderColor: SAND_2,
    borderRadius: 5,
    backgroundColor: ZEBRA,
    height: 38,
    padding: 3,
    justifyContent: "center",
  },
  signatureImage: { height: 30, objectFit: "contain" },
  caption: { fontSize: 6.3, color: SAND_4, marginTop: 3 },
  unsigned: { fontSize: 7, color: SAND_3, textAlign: "center" },
  observations: {
    borderWidth: 1,
    borderColor: SAND_2,
    borderRadius: 5,
    minHeight: 44,
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
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingVertical: 3.5,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderRadius: 5,
  },
  chipText: { fontSize: 6.8, fontFamily: "Helvetica-Bold", letterSpacing: 0.2 },
  chipLarge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingVertical: 5.5,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 6,
  },
  chipLargeText: { fontSize: 8.5, fontFamily: "Helvetica-Bold", letterSpacing: 0.2 },
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
    minHeight: 34,
    paddingVertical: 5,
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
    gap: 5,
  },
  resultCard: {
    width: "23.7%",
    minHeight: 32,
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 7,
  },
  resultName: {
    fontSize: 6.1,
    fontFamily: "Helvetica-Bold",
    marginBottom: 3,
  },
  resultCount: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    marginBottom: 3,
  },
  resultMeta: { fontSize: 6.5, color: SAND_4 },
  alert: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 9,
  },
  alertIcon: { marginTop: 0.5 },
  alertBody: { flex: 1, fontSize: 7.2, lineHeight: 1.5, color: BLACK },
  alertTitle: { fontFamily: "Helvetica-Bold" },
  traceTable: {
    borderWidth: 1,
    borderColor: SAND_2,
  },
  traceHeader: {
    flexDirection: "row",
    backgroundColor: TABLE_HEAD,
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
    paddingVertical: 3,
    paddingHorizontal: 7,
    fontSize: 5.8,
    fontFamily: "Courier-Bold",
    color: SAND_4,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  traceCell: {
    paddingVertical: 3,
    paddingHorizontal: 7,
    fontSize: 6.7,
  },
  traceTechnical: { fontFamily: "Courier", fontSize: 6.4 },
  certObservations: { marginTop: 9 },
  certObservationsBox: {
    borderWidth: 1,
    borderColor: SAND_2,
    borderRadius: 5,
    minHeight: 30,
    padding: 6,
    fontSize: 7.5,
    lineHeight: 1.4,
    backgroundColor: SAND_1,
  },
  parameterTable: {
    marginBottom: 10,
    borderWidth: 1,
    borderColor: SAND_2,
    borderRadius: 5,
    overflow: "hidden",
  },
  verificationHeader: {
    flexDirection: "row",
    backgroundColor: TABLE_HEAD,
    borderBottomWidth: 1,
    borderBottomColor: SAND_2,
  },
  verificationRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: SAND_2,
  },
  verificationRowLast: { flexDirection: "row" },
  verificationCell: {
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderRightColor: SAND_2,
    fontSize: 6.8,
  },
  verificationCellLast: {
    paddingVertical: 5,
    paddingHorizontal: 6,
    fontSize: 6.8,
  },
  certificateAlert: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    marginTop: 10,
    borderWidth: 1,
    borderColor: FAIL_BORDER,
    borderRadius: 6,
    backgroundColor: FAIL_BG,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  signatureBoxEmpty: {
    borderWidth: 1,
    borderColor: SAND_3,
    borderStyle: "dashed",
    borderRadius: 5,
    backgroundColor: WHITE,
    height: 38,
    padding: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  signOffTitle: {
    marginTop: 14,
    marginBottom: 8,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: BLACK,
  },
  signOffMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 3,
    fontSize: 6.6,
    color: SAND_4,
  },
  signOffName: { fontFamily: "Helvetica-Bold", color: BLACK },
  signOffHash: {
    marginTop: 2,
    fontFamily: "Courier",
    fontSize: 5.8,
    color: SAND_3,
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

function IconCheck({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M20 6 9 17l-5-5"
        stroke={color}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function IconAlert({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2.2} fill="none" />
      <Path d="M12 7.5v5" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M12 16.4v0.1" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

function IconClock({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2.2} fill="none" />
      <Path
        d="M12 7v5.2l3.2 2"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function OutcomeIcon({
  outcome,
  color,
  size,
}: {
  outcome: Outcome;
  color: string;
  size?: number;
}) {
  if (outcome === "pass") return <IconCheck color={color} size={size} />;
  if (outcome === "deviation") return <IconAlert color={color} size={size} />;
  return <IconClock color={color} size={size} />;
}

/** Chip de estado del encabezado: icono + etiqueta, en el color del veredicto. */
function OutcomeChip({
  outcome,
  label,
  large,
}: {
  outcome: Outcome;
  label: string;
  large?: boolean;
}) {
  const tone = OUTCOME_TONE[outcome];
  return (
    <View
      style={[
        large ? styles.chipLarge : styles.chip,
        { backgroundColor: tone.bg, borderColor: tone.border },
      ]}
    >
      <OutcomeIcon outcome={outcome} color={tone.color} size={large ? 10 : 8} />
      <Text style={[large ? styles.chipLargeText : styles.chipText, { color: tone.color }]}>
        {label}
      </Text>
    </View>
  );
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
    <View style={styles.header}>
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
      {signature ? (
        <View style={styles.signatureBox}>
          {/* El Image de @react-pdf/renderer dibuja en el PDF, no es un <img>: no admite alt. */}
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={signature.imageUrl} style={styles.signatureImage} />
        </View>
      ) : (
        // Un recuadro punteado y vacío se lee como "falta firmar"; uno sólido
        // se confunde con una firma que no cargó.
        <View style={styles.signatureBoxEmpty}>
          <Text style={styles.unsigned}>{t("pdf.awaitingSignature")}</Text>
        </View>
      )}
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
  const outcome = reportOutcome(report.certificates);
  const tone = OUTCOME_TONE[outcome];
  const channels = countChannels(report.certificates);
  const standards = Array.from(
    new Map(
      report.certificates.map((certificate) => [
        certificate.standard.serial,
        certificate.standard,
      ])
    ).values()
  );
  const certificateSummary = report.certificates.map((certificate) => {
    const columns = evaluatedColumns(certificate);
    return {
      certificate,
      outcome: certificateOutcome(certificate),
      pass: columns.filter((column) => column.status === "PASS").length,
      total: columns.length,
      failed: columns.filter((column) => column.status === "FAIL").length,
      pending: columns.filter(
        (column) => column.status !== "PASS" && column.status !== "FAIL"
      ).length,
    };
  });
  const certificateNames = t("pdf.sectionCount", {
    count: report.certificates.length,
  });

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
        <OutcomeChip outcome={outcome} label={t(outcomeLabelKeys[outcome])} large />
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
        {certificateSummary.map((summary) => {
          const cardTone = OUTCOME_TONE[summary.outcome];
          // La línea de abajo dice por qué la tarjeta no está verde.
          const reason =
            summary.failed > 0
              ? t("pdf.failCount", { count: summary.failed })
              : summary.pending > 0
                ? t("pdf.pendingCount", { count: summary.pending })
                : null;

          return (
            <View
              key={summary.certificate.certificateType}
              style={[
                styles.resultCard,
                { borderColor: cardTone.border, backgroundColor: cardTone.bg },
              ]}
            >
              <Text style={[styles.resultName, { color: cardTone.color }]}>
                {summary.certificate.title}
              </Text>
              <Text style={[styles.resultCount, { color: cardTone.color }]}>
                {t("pdf.passCount", { pass: summary.pass, total: summary.total })}
              </Text>
              <Text style={styles.resultMeta}>
                {reason ? `${reason} · ` : ""}
                {t("pdf.toleranceLabel", {
                  tolerance: summary.certificate.tolerance || "-",
                })}
              </Text>
            </View>
          );
        })}
      </View>

      <View
        style={[styles.alert, { borderColor: tone.border, backgroundColor: tone.bg }]}
      >
        <View style={styles.alertIcon}>
          <OutcomeIcon outcome={outcome} color={tone.color} size={9} />
        </View>
        <Text style={styles.alertBody}>
          <Text style={[styles.alertTitle, { color: tone.color }]}>
            {t("pdf.overallLabel", { outcome: t(outcomeLabelKeys[outcome]).toLowerCase() })}{" "}
          </Text>
          {t("pdf.channelsWithinTolerance", {
            pass: channels.pass,
            total: channels.total,
          })}
          {/* Cuando todo pasó, el conteo ya lo dice todo: repetirlo sobra. */}
          {outcome !== "pass" && ` ${t(outcomeBodyKeys[outcome])}`}
        </Text>
      </View>

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

      {/* Observaciones y firmas comparten una sola fila: la portada ya carga el
          resumen y la trazabilidad, y apilarlas la desborda a una segunda página. */}
      <View style={styles.threeCol}>
        <View style={styles.col}>
          <Text style={styles.blockLabel}>{t("pdf.observations")}</Text>
          <Text style={styles.observations}>{report.observations ?? EMPTY}</Text>
        </View>
        <View style={styles.col}>
          <SignatureSlot
            signature={report.signature}
            label={t("pdf.serviceEngineer")}
            locale={locale}
          />
          {report.signature && (
            <Text style={styles.signOffHash}>
              {t("pdf.signedElectronically")} · SHA {report.signature.payloadHash.slice(0, 4)}…
              {report.signature.payloadHash.slice(-4)}
            </Text>
          )}
        </View>
        <View style={styles.col}>
          <Text style={styles.blockLabel}>{t("pdf.clientAcknowledgement")}</Text>
          <View style={styles.signatureBoxEmpty} />
          <View style={styles.signOffMeta}>
            <Text>{t("pdf.nameRole")}</Text>
            <Text>{t("pdf.date")}</Text>
          </View>
          <Text style={styles.signOffHash}>{t("pdf.countersign")}</Text>
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
  "Reading (As Found)": "pdf.uutAsFound",
  "Reading (As Left)": "pdf.uutAsLeft",
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
  const evaluated = evaluatedColumns(certificate);
  const passCount = evaluated.filter((column) => column.status === "PASS").length;
  const outcome = certificateOutcome(certificate);
  // Las observaciones del ingeniero tienen su propio bloque neutro; esta alerta
  // es solo para las desviaciones que reprobaron.
  const issues = columns
    .filter((column) => column.status === "FAIL")
    .map(
      (column) =>
        column.statusReason ||
        `${column.tagNumber} ${column.description}: ${translate(locale, "pdf.deviationRecorded")}`
    );
  const pointOf = (column: PdfDeviceColumn, kind: PointKind) =>
    column.points.find((point) => point.kind === kind) ?? null;

  return (
    <Page size="LETTER" style={styles.page}>
      <BrandHeader report={report} locale={locale} />

      <View style={styles.titleRow}>
        <Text style={styles.certTitle}>{certificate.title}</Text>
        <OutcomeChip
          outcome={outcome}
          label={
            outcome === "pass"
              ? `${t("measurement.pass")} · ${passCount}/${evaluated.length}`
              : outcome === "deviation"
                ? `${t("measurement.fail")} · ${passCount}/${evaluated.length}`
                : `${t("measurement.pending")} · ${passCount}/${evaluated.length}`
          }
        />
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
              label="Reading (As Found)"
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
              label="Reading (As Left)"
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
        <View style={styles.certificateAlert}>
          <View style={styles.alertIcon}>
            <IconAlert color={FAIL} size={9} />
          </View>
          <Text style={styles.alertBody}>
            <Text style={[styles.alertTitle, { color: FAIL }]}>
              {t("pdf.observation")}.{" "}
            </Text>
            {issues.join(" ")}
          </Text>
        </View>
      )}

      <View style={styles.certObservations}>
        <Text style={styles.blockLabel}>{t("pdf.observations")}</Text>
        <Text style={styles.certObservationsBox}>{certificate.notes ?? EMPTY}</Text>
      </View>

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

function CertificateValidation({
  certificate,
  locale,
}: {
  certificate: PdfCertificate;
  locale: Locale;
}) {
  const t = createTranslator(locale);
  return (
    <View style={styles.twoCol}>
      <View style={styles.col}>
        <SectionBar>{t("pdf.standardValidation")}</SectionBar>
        <View style={styles.table}>
          <Field
            label={t("pdf.deviceDescription")}
            value={certificate.standard.description}
          />
          <Field
            label={t("pdf.manufacturer")}
            value={certificate.standard.manufacturer}
          />
          <Field label={t("pdf.model")} value={certificate.standard.model} />
          <Field label={t("pdf.serial")} value={certificate.standard.serial} />
          <Field
            label={t("pdf.calibrationCertificate")}
            value={certificate.standard.certNumber}
          />
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
  );
}

function TestReadingsPage({
  report,
  certificate,
  locale,
}: {
  report: PdfReport;
  certificate: PdfCertificate;
  locale: Locale;
}) {
  const t = createTranslator(locale);
  const outcome = certificateOutcome(certificate);
  const evaluated = evaluatedColumns(certificate);
  const passCount = evaluated.filter((column) => column.status === "PASS").length;
  const isUltrasonic =
    certificate.certificateType === "ULTRASONIC";
  const readingAt = (column: PdfDeviceColumn, sequence: number) =>
    column.readings.find((reading) => reading.sequence === sequence);
  const testCount = Math.max(
    2,
    ...certificate.columns.map((column) => column.readings.length)
  );

  return (
    <Page size="LETTER" style={styles.page}>
      <BrandHeader report={report} locale={locale} />
      <View style={styles.titleRow}>
        <Text style={styles.certTitle}>{certificate.title}</Text>
        <OutcomeChip
          outcome={outcome}
          label={`${t(
            outcome === "pass"
              ? "measurement.pass"
              : outcome === "deviation"
                ? "measurement.fail"
                : "measurement.pending"
          )} · ${passCount}/${evaluated.length}`}
        />
      </View>
      <Text style={styles.certLead}>{t("pdf.testInstructions")}</Text>

      <SectionBar>{t("pdf.testingParameters")}</SectionBar>
      <View style={styles.parameterTable}>
        {!isUltrasonic && (
          <>
            <Field
              label={t("pdf.meteringRate")}
              value={certificate.params.meteringRate ?? EMPTY}
            />
            <Field
              label={t("pdf.durationMinutes")}
              value={certificate.params.durationMinutes ?? EMPTY}
            />
          </>
        )}
        {isUltrasonic && (
          <Field
            label={t("pdf.targetWeight")}
            value={
              certificate.params.targetWeight
                ? `${certificate.params.targetWeight} g`
                : EMPTY
            }
          />
        )}
        <Field
          label={t("pdf.material")}
          value={certificate.params.material ?? EMPTY}
        />
        <Field
          label={t("pdf.acceptableLimit")}
          value={certificate.tolerance ? `± ${certificate.tolerance}` : EMPTY}
          last
        />
      </View>

      <SectionBar>{t("pdf.devicesUnit", { unit: certificate.unit })}</SectionBar>
      <View style={styles.table}>
        <DataRow
          label="Tag Number"
          locale={locale}
          columns={certificate.columns}
          pick={(column) => column.tagNumber}
          identity
          strong
        />
        <DataRow
          label="Description"
          locale={locale}
          columns={certificate.columns}
          pick={(column) => column.description}
          identity
          zebra
        />
        <DataRow
          label={t("pdf.target")}
          locale={locale}
          columns={certificate.columns}
          pick={(column) => readingAt(column, 1)?.target ?? null}
        />
        {Array.from({ length: testCount }, (_, index) => index + 1).map(
          (sequence) => (
            <React.Fragment key={sequence}>
              <GroupHeader
                label={t("pdf.testNumber", { number: sequence })}
                span={certificate.columns.length}
              />
              <DataRow
                label={t("pdf.actualReading")}
                locale={locale}
                columns={certificate.columns}
                pick={(column) => readingAt(column, sequence)?.value ?? null}
                zebra
              />
              <DataRow
                label="Deviation"
                locale={locale}
                columns={certificate.columns}
                pick={(column) =>
                  readingAt(column, sequence)?.deviation ?? null
                }
              />
            </React.Fragment>
          )
        )}
      </View>

      <View style={styles.certObservations}>
        <Text style={styles.blockLabel}>{t("pdf.observations")}</Text>
        <Text style={styles.certObservationsBox}>
          {certificate.notes ?? EMPTY}
        </Text>
      </View>
      <CertificateValidation certificate={certificate} locale={locale} />
      <Footer report={report} locale={locale} />
    </Page>
  );
}

function VerificationPage({
  report,
  certificate,
  locale,
}: {
  report: PdfReport;
  certificate: PdfCertificate;
  locale: Locale;
}) {
  const t = createTranslator(locale);
  const outcome = certificateOutcome(certificate);

  return (
    <Page size="LETTER" style={styles.page}>
      <BrandHeader report={report} locale={locale} />
      <View style={styles.titleRow}>
        <Text style={styles.certTitle}>{certificate.title}</Text>
        <OutcomeChip
          outcome={outcome}
          label={t(
            outcome === "pass"
              ? "measurement.pass"
              : "measurement.pending"
          )}
        />
      </View>
      <Text style={styles.certLead}>{t("pdf.verificationReferenceOnly")}</Text>

      <SectionBar>{t("pdf.exhaustReadings")}</SectionBar>
      <View style={styles.table}>
        <View style={styles.verificationHeader}>
          <Text style={[styles.verificationCell, { width: "16%" }]}>
            {t("pdf.tagNumber")}
          </Text>
          <Text style={[styles.verificationCell, { width: "28%" }]}>
            {t("pdf.description")}
          </Text>
          <Text style={[styles.verificationCell, { width: "26%" }]}>
            {t("pdf.areaReading")}
          </Text>
          <Text style={[styles.verificationCell, { width: "15%" }]}>SCFM</Text>
          <Text style={[styles.verificationCellLast, { width: "15%" }]}>
            {t("pdf.driveHz")}
          </Text>
        </View>
        {certificate.verificationRows.map((row, index) => (
          <View
            key={`${row.motorTag}:${row.rowLabel}`}
            style={
              index === certificate.verificationRows.length - 1
                ? styles.verificationRowLast
                : styles.verificationRow
            }
          >
            <Text
              style={[
                styles.verificationCell,
                styles.identity,
                { width: "16%" },
              ]}
            >
              {row.motorTag}
            </Text>
            <Text style={[styles.verificationCell, { width: "28%" }]}>
              {row.description}
            </Text>
            <Text style={[styles.verificationCell, { width: "26%" }]}>
              {row.rowLabel}
            </Text>
            <Text
              style={[
                styles.verificationCell,
                styles.traceTechnical,
                { width: "15%", textAlign: "center" },
              ]}
            >
              {row.scfm ?? EMPTY}
            </Text>
            <Text
              style={[
                styles.verificationCellLast,
                styles.traceTechnical,
                { width: "15%", textAlign: "center" },
              ]}
            >
              {row.notApplicable
                ? NA
                : row.driveFrequencyHz ?? EMPTY}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.certObservations}>
        <Text style={styles.blockLabel}>{t("pdf.observations")}</Text>
        <Text style={styles.certObservationsBox}>
          {certificate.notes ?? EMPTY}
        </Text>
      </View>
      <CertificateValidation certificate={certificate} locale={locale} />
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
      {report.certificates.map((certificate) =>
        certificate.layout === CertificateLayout.TEST_READINGS ? (
          <TestReadingsPage
            key={certificate.certificateType}
            report={report}
            certificate={certificate}
            locale={locale}
          />
        ) : certificate.layout === CertificateLayout.VERIFICATION ? (
          <VerificationPage
            key={certificate.certificateType}
            report={report}
            certificate={certificate}
            locale={locale}
          />
        ) : (
          <CertificatePage
            key={certificate.certificateType}
            report={report}
            certificate={certificate}
            locale={locale}
          />
        )
      )}
    </Document>
  );
}

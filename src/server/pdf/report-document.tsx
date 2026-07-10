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
 * Se usan solo las fuentes estándar de PDF (Helvetica). Registrar una fuente
 * externa obligaría a bajarla en tiempo de render, que en serverless es un
 * punto de falla que no vale la pena.
 */
const BRAND = "#0A5AA5";
const BRAND_DARK = "#063C6E";
const RULE = "#BBD5EE";
const RULE_SOFT = "#DCEAF7";
const BAND = "#F1F7FC";
const ZEBRA = "#F8FBFD";
const INK = "#1B2733";
const INK_SOFT = "#5C6B7A";

const PASS = "#0F7B4F";
const PASS_BG = "#E7F6EE";
const FAIL = "#B42318";
const FAIL_BG = "#FDECEA";
const NEUTRAL = "#64748B";
const NEUTRAL_BG = "#F1F5F9";

const styles = StyleSheet.create({
  page: {
    paddingTop: 26,
    paddingBottom: 44,
    paddingHorizontal: 32,
    fontSize: 8,
    fontFamily: "Helvetica",
    color: INK,
  },

  // ---- Cabecera de marca ----
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: BRAND,
    marginBottom: 14,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", color: BRAND_DARK },
  headerSub: { fontSize: 6.5, color: INK_SOFT, letterSpacing: 0.6, textTransform: "uppercase" },
  headerRight: { alignItems: "flex-end" },
  headerMeta: { fontSize: 6.5, color: INK_SOFT },
  headerRef: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: INK },

  // ---- Títulos ----
  docTitle: { fontSize: 15, fontFamily: "Helvetica-Bold", color: BRAND_DARK },
  docLead: { fontSize: 7.5, lineHeight: 1.5, color: INK_SOFT, marginTop: 4, marginBottom: 14 },

  certTitle: { fontSize: 13, fontFamily: "Helvetica-Bold", color: BRAND_DARK },
  certLead: { fontSize: 7, lineHeight: 1.5, color: INK_SOFT, marginTop: 3, marginBottom: 12 },

  sectionBar: {
    backgroundColor: BRAND,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  sectionBarText: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  // ---- Tablas ----
  table: {
    borderWidth: 1,
    borderColor: RULE,
    borderTopWidth: 0,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: RULE_SOFT },
  rowLast: { flexDirection: "row" },
  rowZebra: { backgroundColor: ZEBRA },

  labelCell: {
    width: 118,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderRightColor: RULE_SOFT,
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    color: BRAND_DARK,
  },
  valueCell: { flex: 1, paddingVertical: 4, paddingHorizontal: 6, fontSize: 7.5 },

  dataCell: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRightWidth: 1,
    borderRightColor: RULE_SOFT,
    textAlign: "center",
    fontSize: 7.5,
  },
  dataCellLast: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 4,
    textAlign: "center",
    fontSize: 7.5,
  },

  groupRow: { backgroundColor: BAND },
  groupLabel: {
    width: 118,
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderRightColor: RULE_SOFT,
    fontFamily: "Helvetica-Bold",
    fontSize: 6.5,
    color: BRAND,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  subRow: { backgroundColor: "#FBFDFF" },
  subLabel: {
    width: 118,
    paddingVertical: 2,
    paddingHorizontal: 10,
    borderRightWidth: 1,
    borderRightColor: RULE_SOFT,
    fontFamily: "Helvetica-Bold",
    fontSize: 6,
    color: INK_SOFT,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  excluded: { color: "#9AA7B4" },
  identity: { fontFamily: "Helvetica-Bold", color: BRAND_DARK },

  // ---- Layout de dos columnas ----
  twoCol: { flexDirection: "row", gap: 14, marginTop: 14 },
  col: { flex: 1 },

  // ---- Firma ----
  signatureBox: {
    borderWidth: 1,
    borderColor: RULE,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
    height: 54,
    padding: 3,
    justifyContent: "center",
  },
  signatureImage: { height: 46, objectFit: "contain" },
  caption: { fontSize: 6.5, color: INK_SOFT, marginTop: 3 },
  unsigned: { fontSize: 7, color: "#A9B4BF", textAlign: "center" },

  observations: {
    borderWidth: 1,
    borderColor: RULE,
    borderRadius: 3,
    minHeight: 54,
    padding: 6,
    fontSize: 7.5,
    lineHeight: 1.4,
    backgroundColor: ZEBRA,
  },
  blockLabel: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: BRAND,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 3,
  },

  // ---- Chip de estado ----
  chip: {
    alignSelf: "flex-start",
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 8,
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
  },

  // ---- Pie ----
  footer: {
    position: "absolute",
    bottom: 20,
    left: 32,
    right: 32,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: RULE_SOFT,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 6,
    color: "#8C99A6",
  },
  watermark: {
    position: "absolute",
    top: "44%",
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 74,
    color: "#EDF3F9",
    fontFamily: "Helvetica-Bold",
    letterSpacing: 6,
  },
});

const NA = "N/A";
const EMPTY = "—";

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

function SectionBar({ children }: { children: string }) {
  return (
    <View style={styles.sectionBar}>
      <Text style={styles.sectionBarText}>{children}</Text>
    </View>
  );
}

function BrandHeader({
  report,
  eyebrow,
  locale,
}: {
  report: PdfReport;
  eyebrow: string;
  locale: Locale;
}) {
  const t = createTranslator(locale);
  return (
    <View style={styles.header} fixed>
      <View style={styles.headerLeft}>
        <SigLogo width={44} />
        <View>
          <Text style={styles.headerTitle}>Vapor Sterilant Technology</Text>
          <Text style={styles.headerSub}>{eyebrow}</Text>
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
          ? `${signature.signerName} · ${signature.signerTitle} · ${signature.signedAt}`
          : t("pdf.pendingValidation")}
      </Text>
    </View>
  );
}

function Footer({ report, locale }: { report: PdfReport; locale: Locale }) {
  const t = createTranslator(locale);
  return (
    <View style={styles.footer} fixed>
      <Text>{report.reportNumber}</Text>
      <Text>SIG · Vapor Sterilant Technology</Text>
      <Text
        render={({ pageNumber, totalPages }) =>
          t("pdf.pageOf", { page: pageNumber, total: totalPages })
        }
      />
    </View>
  );
}

function DraftWatermark({ report, locale }: { report: PdfReport; locale: Locale }) {
  if (report.status !== "DRAFT") return null;
  return (
    <Text style={styles.watermark} fixed>
      {translate(locale, "pdf.draft")}
    </Text>
  );
}

function CoverPage({ report, locale }: { report: PdfReport; locale: Locale }) {
  const t = createTranslator(locale);
  return (
    <Page size="LETTER" style={styles.page}>
      <DraftWatermark report={report} locale={locale} />
      <BrandHeader report={report} eyebrow={t("pdf.fieldServiceReport")} locale={locale} />

      <Text style={styles.docTitle}>{t("pdf.fieldServiceReport")}</Text>
      <Text style={styles.docLead}>{t("pdf.introduction")}</Text>

      <SectionBar>{t("pdf.details")}</SectionBar>
      <View style={styles.table}>
        <Field label={t("pdf.reportNumber")} value={report.reportNumber} />
        <Field label={t("pdf.date")} value={report.serviceDate} />
        <Field label={t("pdf.preparedBy")} value={report.preparedBy.name} />
        <Field label={t("pdf.title")} value={report.preparedBy.title} />
        <Field label={t("pdf.contactEmail")} value={report.preparedBy.email} />
        <Field label={t("pdf.client")} value={report.client.name} />
        <Field label={t("pdf.clientAddress")} value={report.client.address} />
        <Field label={t("pdf.city")} value={report.client.city} />
        <Field
          label={t("pdf.zipState")}
          value={`${report.client.zip} / ${report.client.state}`}
        />
        <Field label={t("pdf.fillerModel")} value={report.filler.model} />
        <Field label={t("pdf.fillerSerial")} value={report.filler.serial} last />
      </View>

      <View style={styles.twoCol}>
        <View style={styles.col}>
          <Text style={styles.blockLabel}>{t("pdf.observations")}</Text>
          <Text style={styles.observations}>{report.observations ?? EMPTY}</Text>
        </View>
        <View style={styles.col}>
          <SignatureSlot signature={report.signature} label={t("pdf.signature")} locale={locale} />
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
  const pointOf = (column: PdfDeviceColumn, kind: PointKind) =>
    column.points.find((point) => point.kind === kind) ?? null;

  return (
    <Page size="LETTER" style={styles.page}>
      <DraftWatermark report={report} locale={locale} />
      <BrandHeader report={report} eyebrow={certificate.title} locale={locale} />

      <Text style={styles.certTitle}>{certificate.title}</Text>
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

        {certificate.correctionMethodLabel && (
          <DataRow
            label={certificate.correctionMethodLabel}
            locale={locale}
            columns={columns}
            pick={(c) => c.correctionMethod}
            zebra
          />
        )}

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
          <View style={{ marginTop: 8 }}>
            <Text style={styles.blockLabel}>{t("pdf.result")}</Text>
            <Text style={[styles.chip, statusChipStyle(certificate.overallStatus)]}>
              {certificate.overallStatus === "PASS"
                ? t("measurement.pass")
                : certificate.overallStatus === "FAIL"
                  ? t("measurement.fail")
                  : certificate.overallStatus === "MIXED"
                    ? t("measurement.mixed")
                    : t("measurement.pending")}
            </Text>
          </View>
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

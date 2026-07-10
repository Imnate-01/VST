import { createHash } from "node:crypto";
import { renderToBuffer } from "@react-pdf/renderer";
import { put } from "@vercel/blob";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/server/db";
import { getReportForPdf } from "@/server/pdf/report-data";
import { ReportDocument } from "@/server/pdf/report-document";
import { logAudit } from "@/server/services/audit";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

type Actor = { id: string; role: UserRole };

export type RenderedPdf = {
  buffer: Buffer;
  sha256: string;
  reportNumber: string;
};

export function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Renderiza el PDF del reporte sin efectos secundarios. Sirve para la vista
 * previa del borrador.
 */
export async function renderReportPdf(
  reportId: string,
  actor: Actor,
  locale: Locale = DEFAULT_LOCALE
): Promise<RenderedPdf | null> {
  const report = await getReportForPdf(reportId, actor, locale);
  if (!report) return null;

  // Se invoca el componente en lugar de instanciarlo como elemento: así el tipo
  // que recibe renderToBuffer ya es el <Document> que devuelve, no un wrapper.
  const buffer = await renderToBuffer(ReportDocument({ report, locale }));

  return { buffer, sha256: sha256(buffer), reportNumber: report.reportNumber };
}

/**
 * Genera el PDF definitivo, lo sube y guarda su URL y su hash en el reporte.
 *
 * Requiere que el reporte tenga una firma general activa: el PDF final es la
 * materialización de lo que se firmó.
 */
export async function finalizeReportPdf(
  reportId: string,
  actor: Actor,
  locale: Locale = DEFAULT_LOCALE
) {
  const signature = await prisma.signature.findFirst({
    where: { reportId, certificateId: null, revoked: false },
  });

  if (!signature) {
    throw new Error("Firma el reporte antes de generar el PDF final.");
  }

  const rendered = await renderReportPdf(reportId, actor, locale);
  if (!rendered) {
    throw new Error("Reporte no encontrado.");
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      "Falta BLOB_READ_WRITE_TOKEN: no se puede almacenar el PDF final. Configúralo en el entorno."
    );
  }

  const blob = await put(
    `reports/${reportId}/${rendered.reportNumber}.pdf`,
    rendered.buffer,
    { access: "public", contentType: "application/pdf", addRandomSuffix: true }
  );

  const report = await prisma.report.update({
    where: { id: reportId },
    data: { pdfUrl: blob.url, pdfSha256: rendered.sha256 },
  });

  await logAudit({
    entityType: "Report",
    entityId: reportId,
    action: "generate_pdf",
    userId: actor.id,
    changes: { pdfUrl: blob.url, pdfSha256: rendered.sha256 },
  });

  return report;
}

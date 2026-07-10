import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { renderReportPdf } from "@/server/services/report-pdf";
import { getLocale } from "@/lib/i18n-server";
import { translate } from "@/lib/i18n";

// @react-pdf/renderer necesita APIs de Node (streams, Buffer).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await requireAuth();
  const locale = await getLocale();

  const rendered = await renderReportPdf(id, {
    id: session.user.id,
    role: session.user.role,
  }, locale);

  if (!rendered) {
    return new NextResponse(translate(locale, "pdf.notFound"), { status: 404 });
  }

  return new NextResponse(new Uint8Array(rendered.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${rendered.reportNumber}.pdf"`,
      "Content-Length": String(rendered.buffer.length),
      "X-Report-Sha256": rendered.sha256,
      "Cache-Control": "no-store",
    },
  });
}

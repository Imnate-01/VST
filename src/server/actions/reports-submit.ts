"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { requireAuth } from "@/server/auth";
import { submitReport as submitReportService } from "@/server/services/report-pdf";
import { getLocale } from "@/lib/i18n-server";
import { localizeServerError, translate, type Locale } from "@/lib/i18n";

const submitReportSchema = z.object({ reportId: z.string().min(1) });

function getErrorMessage(error: unknown, locale: Locale): string {
  if (error instanceof Error) return localizeServerError(error.message, locale);
  return translate(locale, "common.unexpectedError");
}

/** Genera el PDF definitivo y cierra el reporte. */
export async function submitReport(input: unknown) {
  const locale = await getLocale();
  const parsed = submitReportSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, message: translate(locale, "common.invalidData") };
  }

  try {
    const session = await requireAuth();
    await submitReportService(
      parsed.data.reportId,
      { id: session.user.id, role: session.user.role },
      locale
    );
  } catch (error) {
    // requireAuth redirige a /login si la sesión ya no es válida; ese "error"
    // es control de flujo de Next y no debe convertirse en un mensaje.
    unstable_rethrow(error);
    return { ok: false as const, message: getErrorMessage(error, locale) };
  }

  revalidatePath(`/reports/${parsed.data.reportId}`);
  revalidatePath("/reports");
  return { ok: true as const };
}

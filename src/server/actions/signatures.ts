"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { requireAuth } from "@/server/auth";
import {
  signCertificate as signCertificateService,
  signReport as signReportService,
} from "@/server/services/signatures";
import {
  getSignCertificateSchema,
  getSignReportSchema,
} from "@/lib/validations/signatures";
import { getLocale } from "@/lib/i18n-server";
import { localizeServerError, translate, type Locale } from "@/lib/i18n";

function getErrorMessage(error: unknown, locale: Locale): string {
  if (error instanceof Error) return localizeServerError(error.message, locale);
  return translate(locale, "common.unexpectedError");
}

export async function signCertificate(input: unknown) {
  const locale = await getLocale();
  const parsed = getSignCertificateSchema(locale).safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, message: parsed.error.errors[0]?.message ?? translate(locale, "validation.invalidSignature") };
  }

  try {
    const session = await requireAuth();
    await signCertificateService(
      { id: session.user.id, role: session.user.role },
      parsed.data
    );
  } catch (error) {
    // requireAuth redirige a /login si la sesión ya no es válida; ese "error"
    // es control de flujo de Next y no debe convertirse en un mensaje.
    unstable_rethrow(error);
    return { ok: false as const, message: getErrorMessage(error, locale) };
  }

  revalidatePath(`/reports/${parsed.data.reportId}`);
  return { ok: true as const };
}

export async function signReport(input: unknown) {
  const locale = await getLocale();
  const parsed = getSignReportSchema(locale).safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, message: parsed.error.errors[0]?.message ?? translate(locale, "validation.invalidSignature") };
  }

  try {
    const session = await requireAuth();
    await signReportService(
      { id: session.user.id, role: session.user.role },
      parsed.data
    );
  } catch (error) {
    // requireAuth redirige a /login si la sesión ya no es válida; ese "error"
    // es control de flujo de Next y no debe convertirse en un mensaje.
    unstable_rethrow(error);
    return { ok: false as const, message: getErrorMessage(error, locale) };
  }

  revalidatePath(`/reports/${parsed.data.reportId}`);
  return { ok: true as const };
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { requireAuth } from "@/server/auth";
import {
  updateCertificateNotes as updateCertificateNotesService,
  upsertCertificateMeasurement,
} from "@/server/services/certificates";
import {
  getUpdateCertificateNotesSchema,
  getUpsertMeasurementSchema,
} from "@/lib/validations/measurements";
import { getNextCertificateHref } from "@/lib/certificates";
import { getLocale } from "@/lib/i18n-server";
import { localizeServerError, translate, type Locale } from "@/lib/i18n";

function getErrorMessage(error: unknown, locale: Locale): string {
  if (error instanceof Error) return localizeServerError(error.message, locale);
  return translate(locale, "common.unexpectedError");
}

export async function upsertMeasurement(input: unknown) {
  const locale = await getLocale();
  const parsed = getUpsertMeasurementSchema(locale).safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.errors[0]?.message ?? translate(locale, "common.invalidData") };
  }

  try {
    const session = await requireAuth();
    await upsertCertificateMeasurement(
      { id: session.user.id, role: session.user.role },
      parsed.data
    );
  } catch (error) {
    // requireAuth redirige a /login si la sesión ya no es válida; ese "error"
    // es control de flujo de Next y no debe convertirse en un mensaje.
    unstable_rethrow(error);
    return { ok: false, message: getErrorMessage(error, locale) };
  }

  revalidatePath("/reports");
  redirect(
    getNextCertificateHref({
      reportId: parsed.data.reportId,
      certificateType: parsed.data.certificateType,
    })
  );
}

export async function updateCertificateNotes(input: unknown) {
  const locale = await getLocale();
  const parsed = getUpdateCertificateNotesSchema(locale).safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.errors[0]?.message ?? translate(locale, "common.invalidData") };
  }

  try {
    const session = await requireAuth();
    await updateCertificateNotesService(
      { id: session.user.id, role: session.user.role },
      parsed.data
    );
    revalidatePath("/reports");
    return { ok: true };
  } catch (error) {
    // requireAuth redirige a /login si la sesión ya no es válida; ese "error"
    // es control de flujo de Next y no debe convertirse en un mensaje.
    unstable_rethrow(error);
    return { ok: false, message: getErrorMessage(error, locale) };
  }
}

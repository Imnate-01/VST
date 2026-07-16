"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { requireAuth } from "@/server/auth";
import {
  upsertCertificateMeasurement,
  upsertCertificateTestReadings,
  upsertCertificateVerification,
} from "@/server/services/certificates";
import {
  getUpsertMeasurementSchema,
  getUpsertTestReadingsSchema,
  getUpsertVerificationSchema,
} from "@/lib/validations/measurements";
import { certificateHref } from "@/lib/certificates";
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
    const certificateStatus = await upsertCertificateMeasurement(
      { id: session.user.id, role: session.user.role },
      parsed.data
    );
    revalidatePath(`/reports/${parsed.data.reportId}`);
    revalidatePath(certificateHref(parsed.data.reportId, parsed.data.certificateType));
    return { ok: true as const, certificateStatus };
  } catch (error) {
    // requireAuth redirige a /login si la sesión ya no es válida; ese "error"
    // es control de flujo de Next y no debe convertirse en un mensaje.
    unstable_rethrow(error);
    return { ok: false, message: getErrorMessage(error, locale) };
  }
}

export async function upsertTestReadings(input: unknown) {
  const locale = await getLocale();
  const parsed = getUpsertTestReadingsSchema(locale).safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.errors[0]?.message ??
        translate(locale, "common.invalidData"),
    };
  }

  try {
    const session = await requireAuth();
    const certificateStatus = await upsertCertificateTestReadings(
      { id: session.user.id, role: session.user.role },
      parsed.data
    );
    revalidatePath("/reports");
    revalidatePath(
      certificateHref(parsed.data.reportId, parsed.data.certificateType)
    );
    return { ok: true, certificateStatus };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, message: getErrorMessage(error, locale) };
  }
}

export async function upsertVerification(input: unknown) {
  const locale = await getLocale();
  const parsed = getUpsertVerificationSchema(locale).safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.errors[0]?.message ??
        translate(locale, "common.invalidData"),
    };
  }

  try {
    const session = await requireAuth();
    const certificateStatus = await upsertCertificateVerification(
      { id: session.user.id, role: session.user.role },
      parsed.data
    );
    revalidatePath("/reports");
    revalidatePath(
      certificateHref(parsed.data.reportId, parsed.data.certificateType)
    );
    return { ok: true, certificateStatus };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, message: getErrorMessage(error, locale) };
  }
}

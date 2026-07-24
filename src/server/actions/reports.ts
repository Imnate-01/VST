"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { requireAuth } from "@/server/auth";
import {
  createChecklistDevice,
  createDraftReport,
  syncReportDeviceSelections,
  syncReportStandards,
  updateReportBasicInfo,
} from "@/server/services/reports";
import {
  getChecklistDeviceSchema,
  getDeviceSelectionSchema,
  getReportInfoSchema,
  getReportStandardsSchema,
} from "@/lib/validations/reports";
import {
  certificateHref,
  getCertificateLabel,
  implementedCertificateTypes,
} from "@/lib/certificates";
import { getLocale } from "@/lib/i18n-server";
import { localizeServerError, translate, type Locale } from "@/lib/i18n";

function getErrorMessage(error: unknown, locale: Locale): string {
  if (error instanceof Error) return localizeServerError(error.message, locale);
  return translate(locale, "common.unexpectedError");
}

export async function createReport() {
  const session = await requireAuth();
  const report = await createDraftReport(session.user.id);
  revalidatePath("/reports");
  redirect(`/reports/${report.id}/wizard/info`);
}

export async function updateReportInfo(input: unknown) {
  const locale = await getLocale();
  const parsed = getReportInfoSchema(locale).safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.errors[0]?.message ?? translate(locale, "common.invalidData") };
  }

  try {
    const session = await requireAuth();
    await updateReportBasicInfo(
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
  redirect(`/reports/${parsed.data.reportId}/wizard/devices`);
}

export async function updateDeviceSelections(input: unknown) {
  const locale = await getLocale();
  const parsed = getDeviceSelectionSchema(locale).safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.errors[0]?.message ?? translate(locale, "common.invalidData") };
  }

  try {
    const session = await requireAuth();
    await syncReportDeviceSelections(
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
  redirect(`/reports/${parsed.data.reportId}/wizard/standards`);
}

/**
 * Registra un sensor faltante desde el checklist y devuelve la fila ya
 * formateada, para que el formulario la agregue sin recargar el paso y sin
 * perder las selecciones que el usuario todavía no guardó.
 */
export async function registerChecklistDevice(input: unknown) {
  const locale = await getLocale();
  const parsed = getChecklistDeviceSchema(locale).safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      message: parsed.error.errors[0]?.message ?? translate(locale, "common.invalidData"),
    };
  }

  try {
    const session = await requireAuth();
    const result = await createChecklistDevice(
      { id: session.user.id, role: session.user.role },
      parsed.data
    );

    if (result === "duplicate") {
      return {
        ok: false as const,
        message: translate(locale, "devices.duplicateTag", { tag: parsed.data.tagNumber }),
      };
    }

    revalidatePath(`/reports/${parsed.data.reportId}/wizard/devices`);
    revalidatePath("/admin/devices");

    return {
      ok: true as const,
      device: {
        id: result.id,
        tagNumber: result.tagNumber,
        description: result.description,
        deviceType: result.deviceType as string,
        tolerance: `± ${result.toleranceValue.toString()}${
          result.toleranceIsPercent ? "% " : " "
        }${result.toleranceUnit}`,
        certificateType: result.certificateTypes
          .map((type) => getCertificateLabel(type, locale))
          .join(" · "),
      },
    };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false as const, message: getErrorMessage(error, locale) };
  }
}

export async function updateReportStandards(input: unknown) {
  const locale = await getLocale();
  const parsed = getReportStandardsSchema(locale).safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.errors[0]?.message ?? translate(locale, "common.invalidData") };
  }

  try {
    const session = await requireAuth();
    await syncReportStandards(
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

  const selectedTypes = new Set(
    parsed.data.standards.map((standard) => standard.certificateType)
  );
  const firstCertificate = implementedCertificateTypes.find((type) =>
    selectedTypes.has(type)
  );
  redirect(
    firstCertificate
      ? certificateHref(parsed.data.reportId, firstCertificate)
      : `/reports/${parsed.data.reportId}`
  );
}

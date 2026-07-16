"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/server/auth";
import { prisma } from "@/server/db";
import { logAudit } from "@/server/services/audit";
import { getStandardInstrumentSchema } from "@/lib/validations/standard-instruments";
import { getLocale } from "@/lib/i18n-server";
import { translate } from "@/lib/i18n";

function utcDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export async function saveStandardInstrument(input: unknown) {
  const locale = await getLocale();
  const parsed = getStandardInstrumentSchema(locale).safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      message: parsed.error.errors[0]?.message ?? translate(locale, "common.invalidData"),
    };
  }

  try {
    const session = await requireAdmin();
    const value = parsed.data;
    const duplicate = await prisma.standardInstrument.findFirst({
      where: {
        serialNumber: { equals: value.serialNumber, mode: "insensitive" },
        ...(value.id ? { id: { not: value.id } } : {}),
      },
      select: { id: true },
    });
    if (duplicate) {
      return { ok: false as const, message: translate(locale, "standardsAdmin.duplicateSerial") };
    }

    const data = {
      description: value.description,
      manufacturer: value.manufacturer,
      model: value.model,
      serialNumber: value.serialNumber,
      calibrationCertNumber: value.calibrationCertNumber,
      calibrationDate: utcDate(value.calibrationDate),
      calibrationExpiresAt: utcDate(value.calibrationExpiresAt),
      active: value.active,
    };

    const instrument = value.id
      ? await prisma.standardInstrument.update({ where: { id: value.id }, data })
      : await prisma.standardInstrument.create({ data });

    await logAudit({
      entityType: "StandardInstrument",
      entityId: instrument.id,
      action: value.id ? "update" : "create",
      userId: session.user.id,
      changes: {
        description: instrument.description,
        manufacturer: instrument.manufacturer,
        model: instrument.model,
        serialNumber: instrument.serialNumber,
        calibrationCertNumber: instrument.calibrationCertNumber,
        calibrationExpiresAt: instrument.calibrationExpiresAt.toISOString(),
        active: instrument.active,
      },
    });

    revalidatePath("/admin/standards");
    revalidatePath("/dashboard");
    return { ok: true as const, message: translate(locale, "standardsAdmin.saved") };
  } catch (error) {
    unstable_rethrow(error);
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : translate(locale, "common.unexpectedError"),
    };
  }
}

export async function deleteStandardInstrument(input: unknown) {
  const locale = await getLocale();
  const parsed = z.string().min(1).safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, message: translate(locale, "common.invalidData") };
  }

  try {
    const session = await requireAdmin();
    const result = await prisma.$transaction(async (tx) => {
      const instrument = await tx.standardInstrument.findUnique({
        where: { id: parsed.data },
        include: { _count: { select: { reportStandards: true } } },
      });
      if (!instrument) return null;

      if (instrument._count.reportStandards > 0) {
        await tx.standardInstrument.update({
          where: { id: instrument.id },
          data: { active: false },
        });
        return { id: instrument.id, archived: true, links: instrument._count.reportStandards };
      }

      await tx.standardInstrument.delete({ where: { id: instrument.id } });
      return { id: instrument.id, archived: false, links: 0 };
    });

    if (!result) {
      return { ok: false as const, message: translate(locale, "standardsAdmin.notFound") };
    }

    await logAudit({
      entityType: "StandardInstrument",
      entityId: result.id,
      action: result.archived ? "archive" : "delete",
      userId: session.user.id,
      changes: { linkedReports: result.links },
    });

    revalidatePath("/admin/standards");
    revalidatePath("/dashboard");
    return {
      ok: true as const,
      message: translate(
        locale,
        result.archived ? "standardsAdmin.archived" : "standardsAdmin.deleted"
      ),
    };
  } catch (error) {
    unstable_rethrow(error);
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : translate(locale, "common.unexpectedError"),
    };
  }
}

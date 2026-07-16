"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { requireAuth } from "@/server/auth";
import { prisma } from "@/server/db";
import { logAudit } from "@/server/services/audit";
import { getLocale } from "@/lib/i18n-server";
import { translate } from "@/lib/i18n";
import { getChangePasswordSchema, getProfileSchema } from "@/lib/validations/profile";

export async function updateOwnProfile(input: unknown) {
  const locale = await getLocale();
  const parsed = getProfileSchema(locale).safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      message: parsed.error.errors[0]?.message ?? translate(locale, "common.invalidData"),
    };
  }

  try {
    const session = await requireAuth();
    const duplicate = await prisma.user.findFirst({
      where: {
        email: { equals: parsed.data.email, mode: "insensitive" },
        id: { not: session.user.id },
      },
      select: { id: true },
    });
    if (duplicate) {
      return { ok: false as const, message: translate(locale, "profile.emailInUse") };
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: parsed.data,
      select: { id: true, name: true, title: true, email: true },
    });

    await logAudit({
      entityType: "User",
      entityId: user.id,
      action: "profile_update",
      userId: user.id,
      changes: { name: user.name, title: user.title, email: user.email },
    });

    revalidatePath("/", "layout");
    return { ok: true as const, message: translate(locale, "profile.profileSaved") };
  } catch (error) {
    unstable_rethrow(error);
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : translate(locale, "common.unexpectedError"),
    };
  }
}

export async function changeOwnPassword(input: unknown) {
  const locale = await getLocale();
  const parsed = getChangePasswordSchema(locale).safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      message: parsed.error.errors[0]?.message ?? translate(locale, "common.invalidData"),
    };
  }

  try {
    const session = await requireAuth();
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, passwordHash: true },
    });
    if (!user || !(await bcrypt.compare(parsed.data.currentPassword, user.passwordHash))) {
      return {
        ok: false as const,
        message: translate(locale, "profile.currentPasswordInvalid"),
      };
    }

    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    await logAudit({
      entityType: "User",
      entityId: user.id,
      action: "password_change",
      userId: user.id,
      changes: { passwordChanged: true },
    });

    return { ok: true as const, message: translate(locale, "profile.passwordChanged") };
  } catch (error) {
    unstable_rethrow(error);
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : translate(locale, "common.unexpectedError"),
    };
  }
}

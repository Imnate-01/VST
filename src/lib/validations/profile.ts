import { z } from "zod";
import { DEFAULT_LOCALE, translate, type Locale } from "@/lib/i18n";

export function getProfileSchema(locale: Locale) {
  const required = translate(locale, "profile.required");
  return z.object({
    name: z.string().trim().min(2, required).max(100),
    title: z.string().trim().min(2, required).max(100),
    email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  });
}

export function getChangePasswordSchema(locale: Locale) {
  return z
    .object({
      currentPassword: z.string().min(1, translate(locale, "profile.required")).max(128),
      newPassword: z
        .string()
        .min(10, translate(locale, "profile.passwordRequirements"))
        .max(128)
        .regex(/[a-z]/, translate(locale, "profile.passwordRequirements"))
        .regex(/[A-Z]/, translate(locale, "profile.passwordRequirements"))
        .regex(/[0-9]/, translate(locale, "profile.passwordRequirements")),
      confirmPassword: z.string().min(1, translate(locale, "profile.required")).max(128),
    })
    .refine((value) => value.newPassword === value.confirmPassword, {
      message: translate(locale, "profile.passwordMismatch"),
      path: ["confirmPassword"],
    });
}

export const profileSchema = getProfileSchema(DEFAULT_LOCALE);
export const changePasswordSchema = getChangePasswordSchema(DEFAULT_LOCALE);
export type ProfileInput = z.infer<typeof profileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

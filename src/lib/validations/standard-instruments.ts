import { z } from "zod";
import { DEFAULT_LOCALE, translate, type Locale } from "@/lib/i18n";

export function getStandardInstrumentSchema(locale: Locale) {
  const required = translate(locale, "standardsAdmin.required");
  return z
    .object({
      id: z.string().min(1).optional(),
      description: z.string().trim().min(1, required).max(150),
      manufacturer: z.string().trim().min(1, required).max(100),
      model: z.string().trim().min(1, required).max(100),
      serialNumber: z.string().trim().min(1, required).max(100),
      calibrationCertNumber: z.string().trim().min(1, required).max(100),
      calibrationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, required),
      calibrationExpiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, required),
      active: z.boolean(),
    })
    .refine((value) => value.calibrationExpiresAt > value.calibrationDate, {
      message: translate(locale, "standardsAdmin.invalidDates"),
      path: ["calibrationExpiresAt"],
    });
}

export const standardInstrumentSchema = getStandardInstrumentSchema(DEFAULT_LOCALE);
export type StandardInstrumentInput = z.infer<typeof standardInstrumentSchema>;

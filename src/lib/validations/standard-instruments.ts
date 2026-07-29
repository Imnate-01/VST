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
      certificationStatus: z.enum(["CERTIFIED", "NOT_APPLICABLE", "PENDING"]),
      calibrationCertNumber: z.string().trim().max(100),
      calibrationDate: z.string(),
      calibrationExpiresAt: z.string(),
      active: z.boolean(),
    })
    .superRefine((value, ctx) => {
      if (value.certificationStatus !== "CERTIFIED") return;

      if (!value.calibrationCertNumber) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: required,
          path: ["calibrationCertNumber"],
        });
      }

      const datePattern = /^\d{4}-\d{2}-\d{2}$/;
      if (!datePattern.test(value.calibrationDate)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: required,
          path: ["calibrationDate"],
        });
      }
      if (!datePattern.test(value.calibrationExpiresAt)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: required,
          path: ["calibrationExpiresAt"],
        });
      } else if (
        datePattern.test(value.calibrationDate) &&
        value.calibrationExpiresAt <= value.calibrationDate
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: translate(locale, "standardsAdmin.invalidDates"),
          path: ["calibrationExpiresAt"],
        });
      }
    });
}

export const standardInstrumentSchema = getStandardInstrumentSchema(DEFAULT_LOCALE);
export type StandardInstrumentInput = z.infer<typeof standardInstrumentSchema>;

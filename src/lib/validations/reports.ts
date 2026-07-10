import { CertificateType } from "@prisma/client";
import { z } from "zod";
import { DEFAULT_LOCALE, translate, type Locale } from "@/lib/i18n";

export function getReportInfoSchema(locale: Locale) {
  return z.object({
  reportId: z.string().min(1),
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, translate(locale, "validation.invalidDate")),
  fillerId: z.string().min(1, translate(locale, "validation.selectFiller")),
  observations: z.string().max(2000, translate(locale, "validation.max2000")).optional(),
  });
}

export const reportInfoSchema = getReportInfoSchema(DEFAULT_LOCALE);

export type ReportInfoInput = z.infer<typeof reportInfoSchema>;

export function getDeviceSelectionSchema(locale: Locale) {
  return z
  .object({
    reportId: z.string().min(1),
    selections: z.array(
      z.object({
        deviceCatalogId: z.string().min(1),
        included: z.boolean(),
        exclusionReason: z.string().max(500, translate(locale, "validation.max500")).optional(),
      })
    ),
  })
  .superRefine((value, ctx) => {
    value.selections.forEach((selection, index) => {
      if (!selection.included && !selection.exclusionReason?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: translate(locale, "validation.reasonRequired"),
          path: ["selections", index, "exclusionReason"],
        });
      }
    });
  });
}

export const deviceSelectionSchema = getDeviceSelectionSchema(DEFAULT_LOCALE);

export type DeviceSelectionInput = z.infer<typeof deviceSelectionSchema>;

export function getReportStandardsSchema(locale: Locale) {
  return z.object({
  reportId: z.string().min(1),
  standards: z.array(
    z.object({
      certificateType: z.nativeEnum(CertificateType),
      standardInstrumentId: z.string().min(1, translate(locale, "validation.selectStandard")),
    })
  ),
  });
}

export const reportStandardsSchema = getReportStandardsSchema(DEFAULT_LOCALE);

export type ReportStandardsInput = z.infer<typeof reportStandardsSchema>;

import { CertificateType, DeviceType } from "@prisma/client";
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

/**
 * Alta de un sensor que falta en el catálogo del modelo, hecha desde el
 * checklist del reporte. La tolerancia llega como texto porque el campo del
 * formulario es libre y Decimal se arma recién en el servicio.
 */
export function getChecklistDeviceSchema(locale: Locale) {
  return z.object({
    reportId: z.string().min(1),
    tagNumber: z
      .string()
      .trim()
      .min(1, translate(locale, "validation.tagRequired"))
      .max(50, translate(locale, "validation.max50")),
    description: z
      .string()
      .trim()
      .min(1, translate(locale, "validation.descriptionRequired"))
      .max(200, translate(locale, "validation.max200")),
    deviceType: z.nativeEnum(DeviceType),
    toleranceValue: z
      .string()
      .trim()
      .min(1, translate(locale, "validation.validNumber"))
      .refine((value) => Number.isFinite(Number(value)), translate(locale, "validation.validNumber"))
      .refine((value) => Number(value) > 0, translate(locale, "validation.positiveNumber")),
    toleranceUnit: z
      .string()
      .trim()
      .min(1, translate(locale, "validation.unitRequired"))
      .max(20, translate(locale, "validation.max20")),
    toleranceIsPercent: z.boolean(),
    certificateTypes: z
      .array(z.nativeEnum(CertificateType))
      .min(1, translate(locale, "validation.certificateRequired")),
  });
}

export const checklistDeviceSchema = getChecklistDeviceSchema(DEFAULT_LOCALE);

export type ChecklistDeviceInput = z.infer<typeof checklistDeviceSchema>;

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

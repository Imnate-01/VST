import { CertificateType, PointKind } from "@prisma/client";
import { z } from "zod";
import { DEFAULT_LOCALE, translate, type Locale } from "@/lib/i18n";

function getDecimalStringSchema(locale: Locale) {
  return z.string().trim().regex(/^-?\d+(\.\d+)?$/, translate(locale, "validation.validNumber"));
}

function getOptionalDecimalStringSchema(locale: Locale) {
  return z.preprocess(
    (value) => {
      if (typeof value === "string" && value.trim() === "") return undefined;
      return value;
    },
    getDecimalStringSchema(locale).optional()
  );
}

export function getMeasurementPointSchema(locale: Locale) {
  const optionalDecimalStringSchema = getOptionalDecimalStringSchema(locale);
  return z.object({
    kind: z.nativeEnum(PointKind),
    /** Condición de ensayo (blower speed) en el layout SETPOINT. */
    conditionValue: optionalDecimalStringSchema,
    /** Setpoint nominal; es la referencia usada para calcular la desviación. */
    targetNominal: optionalDecimalStringSchema,
    asFoundReading: optionalDecimalStringSchema,
    asLeftReading: optionalDecimalStringSchema,
  });
}

export const measurementPointSchema = getMeasurementPointSchema(DEFAULT_LOCALE);

export function getCertificateMeasurementRowSchema(locale: Locale) {
  return z.object({
    deviceSelectionId: z.string().min(1),
    correctionMethod: z.string().trim().max(100, translate(locale, "validation.max100")).optional(),
    notes: z.string().max(2000, translate(locale, "validation.max2000")).optional(),
    points: z
      .array(getMeasurementPointSchema(locale))
      .min(1, translate(locale, "validation.pointRequired"))
      .superRefine((points, ctx) => {
        const seen = new Set<PointKind>();
        for (const point of points) {
          if (seen.has(point.kind)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: translate(locale, "validation.duplicatePoint", { point: point.kind }),
            });
          }
          seen.add(point.kind);
        }
      }),
  });
}

export const certificateMeasurementRowSchema = getCertificateMeasurementRowSchema(DEFAULT_LOCALE);

export function getUpsertMeasurementSchema(locale: Locale) {
  return z.object({
  reportId: z.string().min(1),
  certificateId: z.string().min(1),
  certificateType: z.nativeEnum(CertificateType),
  measurements: z.array(getCertificateMeasurementRowSchema(locale)),
  });
}

export const upsertMeasurementSchema = getUpsertMeasurementSchema(DEFAULT_LOCALE);

export function getUpsertTestReadingsSchema(locale: Locale) {
  const optionalDecimal = getOptionalDecimalStringSchema(locale);

  return z.object({
    reportId: z.string().min(1),
    certificateId: z.string().min(1),
    certificateType: z.nativeEnum(CertificateType),
    params: z.object({
      meteringRate: optionalDecimal,
      durationMinutes: optionalDecimal,
      targetWeight: optionalDecimal,
      material: z.string().trim().max(200).optional(),
    }),
    measurements: z.array(
      z.object({
        deviceSelectionId: z.string().min(1),
        notes: z.string().max(2000, translate(locale, "validation.max2000")).optional(),
        readings: z
          .array(
            z.object({
              sequence: z.number().int().positive(),
              value: optionalDecimal,
            })
          )
          .min(1),
      })
    ),
  });
}

export const upsertTestReadingsSchema =
  getUpsertTestReadingsSchema(DEFAULT_LOCALE);

export function getUpsertVerificationSchema(locale: Locale) {
  const optionalDecimal = getOptionalDecimalStringSchema(locale);

  return z.object({
    reportId: z.string().min(1),
    certificateId: z.string().min(1),
    certificateType: z.literal(CertificateType.EXHAUST),
    rows: z
      .array(
        z.object({
          motorTag: z.string().trim().min(1).max(100),
          description: z.string().trim().min(1).max(200),
          rowLabel: z.string().trim().min(1).max(200),
          scfm: optionalDecimal,
          driveFrequencyHz: optionalDecimal,
          notApplicable: z.boolean(),
          displayOrder: z.number().int().nonnegative(),
          notes: z.string().max(2000, translate(locale, "validation.max2000")).optional(),
        })
      )
      .min(1),
  });
}

export const upsertVerificationSchema =
  getUpsertVerificationSchema(DEFAULT_LOCALE);

export type MeasurementPointInput = z.infer<typeof measurementPointSchema>;
export type CertificateMeasurementRowInput = z.infer<
  typeof certificateMeasurementRowSchema
>;
export type UpsertMeasurementInput = z.infer<typeof upsertMeasurementSchema>;
export type UpsertTestReadingsInput = z.infer<typeof upsertTestReadingsSchema>;
export type UpsertVerificationInput = z.infer<typeof upsertVerificationSchema>;

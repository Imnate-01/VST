import { z } from "zod";
import { DEFAULT_LOCALE, translate, type Locale } from "@/lib/i18n";

/** PNG en data URL, tal como lo produce signature_pad con toDataURL(). */
function getSignatureDataUrlSchema(locale: Locale) {
  return z
    .string()
    .startsWith("data:image/png;base64,", translate(locale, "validation.signaturePng"))
    .max(1_400_000, translate(locale, "validation.signatureTooLarge"));
}

export function getSignCertificateSchema(locale: Locale) {
  return z.object({
  reportId: z.string().min(1),
  certificateId: z.string().min(1),
  signatureDataUrl: getSignatureDataUrlSchema(locale),
  });
}

export const signCertificateSchema = getSignCertificateSchema(DEFAULT_LOCALE);

export function getSignReportSchema(locale: Locale) {
  return z.object({
  reportId: z.string().min(1),
  signatureDataUrl: getSignatureDataUrlSchema(locale),
  });
}

export const signReportSchema = getSignReportSchema(DEFAULT_LOCALE);

export type SignCertificateInput = z.infer<typeof signCertificateSchema>;
export type SignReportInput = z.infer<typeof signReportSchema>;

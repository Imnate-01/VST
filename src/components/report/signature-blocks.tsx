"use client";

import { signCertificate, signReport } from "@/server/actions/signatures";
import { SignatureCapture } from "@/components/report/signature-capture";
import { useLanguage } from "@/components/language-provider";

type ExistingSignature = {
  signatureImageUrl: string;
  signedAt: Date;
  signerName: string;
  signerTitle: string;
};

export function CertificateSignatureBlock({
  reportId,
  certificateId,
  existing,
  blockedReason,
}: {
  reportId: string;
  certificateId: string;
  existing: ExistingSignature | null;
  blockedReason: string | null;
}) {
  const { t } = useLanguage();
  return (
    <SignatureCapture
      title={t("signature.preparerValidation")}
      description={t("signature.preparerDescription")}
      existing={existing}
      blockedReason={blockedReason}
      onSign={(signatureDataUrl) =>
        signCertificate({ reportId, certificateId, signatureDataUrl })
      }
    />
  );
}

export function ReportSignatureBlock({
  reportId,
  existing,
  blockedReason,
}: {
  reportId: string;
  existing: ExistingSignature | null;
  blockedReason: string | null;
}) {
  const { t } = useLanguage();
  return (
    <SignatureCapture
      title={t("signature.reportTitle")}
      description={t("signature.reportDescription")}
      existing={existing}
      blockedReason={blockedReason}
      onSign={(signatureDataUrl) => signReport({ reportId, signatureDataUrl })}
    />
  );
}

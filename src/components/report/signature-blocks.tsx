"use client";

import { signReport } from "@/server/actions/signatures";
import { saveCertificateSignature } from "@/lib/offline/save";
import { SignatureCapture } from "@/components/report/signature-capture";
import { useNetworkStatus } from "@/components/offline/network-status-provider";
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
  const { online } = useNetworkStatus();
  return (
    <SignatureCapture
      title={t("signature.preparerValidation")}
      description={t("signature.preparerDescription")}
      existing={existing}
      blockedReason={blockedReason}
      onSign={(signatureDataUrl) =>
        saveCertificateSignature(
          { reportId, certificateId, signatureDataUrl },
          online
        )
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

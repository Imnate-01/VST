"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CertificateType } from "@prisma/client";
import { CertificateSignatureBlock } from "@/components/report/signature-blocks";
import {
  StepCertificateForm,
  type MeasurementRow,
} from "@/components/wizard/step-certificate-form";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/language-provider";
import type { UpsertMeasurementInput } from "@/lib/validations/measurements";

type CertificateStatus = "PENDING" | "PASS" | "FAIL" | "MIXED";

type ExistingSignature = {
  signatureImageUrl: string;
  signedAt: Date;
  signerName: string;
  signerTitle: string;
};

type Props = {
  title: string;
  description: string;
  reportId: string;
  certificateId: string;
  certificateType: CertificateType;
  rows: MeasurementRow[];
  initialValues: UpsertMeasurementInput;
  initialReadyToSign: boolean;
  signature: ExistingSignature | null;
  nextHref: string;
};

export function CertificateStep({
  initialReadyToSign,
  signature,
  nextHref,
  ...formProps
}: Props) {
  const { t } = useLanguage();
  const [dirty, setDirty] = useState(false);
  const [readyToSign, setReadyToSign] = useState(initialReadyToSign);
  const [signatureInvalidated, setSignatureInvalidated] = useState(false);
  const signatureVersion = signature?.signedAt.toISOString();

  useEffect(() => {
    setReadyToSign(initialReadyToSign);
  }, [initialReadyToSign]);

  useEffect(() => {
    setSignatureInvalidated(false);
  }, [signatureVersion]);

  const activeSignature = signatureInvalidated ? null : signature;
  const blockedReason = dirty
    ? t("certificate.saveChangesBeforeSign")
    : readyToSign
      ? null
      : t("certificate.completeBeforeSign");

  return (
    <div className="space-y-6">
      <StepCertificateForm
        {...formProps}
        onDirtyChange={setDirty}
        onSaved={(status: CertificateStatus) => {
          setDirty(false);
          setReadyToSign(status !== "PENDING");
          setSignatureInvalidated(true);
        }}
      />

      <div id="certificate-signature" className="space-y-4 scroll-mt-24">
        <CertificateSignatureBlock
          reportId={formProps.reportId}
          certificateId={formProps.certificateId}
          existing={activeSignature}
          blockedReason={blockedReason}
        />
        {activeSignature && !dirty && (
          <div className="flex justify-end">
            <Button asChild>
              <Link href={nextHref}>{t("common.continue")}</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

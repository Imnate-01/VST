"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CertificateType } from "@prisma/client";
import { CertificateSignatureBlock } from "@/components/report/signature-blocks";
import {
  StepCertificateForm,
  type MeasurementRow,
} from "@/components/wizard/step-certificate-form";
import { StepTestReadingsForm } from "@/components/wizard/step-test-readings-form";
import { StepVerificationForm } from "@/components/wizard/step-verification-form";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/language-provider";
import type {
  UpsertMeasurementInput,
  UpsertTestReadingsInput,
  UpsertVerificationInput,
} from "@/lib/validations/measurements";

type CertificateStatus = "PENDING" | "PASS" | "FAIL" | "MIXED";

type ExistingSignature = {
  signatureImageUrl: string;
  signedAt: Date;
  signerName: string;
  signerTitle: string;
};

type CommonProps = {
  title: string;
  description: string;
  reportId: string;
  certificateId: string;
  certificateType: CertificateType;
  initialReadyToSign: boolean;
  signature: ExistingSignature | null;
  nextHref: string;
};

type Props = CommonProps &
  (
    | {
        mode: "POINTS";
        rows: MeasurementRow[];
        initialValues: UpsertMeasurementInput;
      }
    | {
        mode: "TEST_READINGS";
        rows: MeasurementRow[];
        initialValues: UpsertTestReadingsInput;
      }
    | {
        mode: "VERIFICATION";
        initialValues: UpsertVerificationInput;
      }
  );

export function CertificateStep({
  initialReadyToSign,
  signature,
  nextHref,
  ...props
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
  const formCallbacks = {
    onDirtyChange: setDirty,
    onSaved: (status: CertificateStatus) => {
      setDirty(false);
      setReadyToSign(status !== "PENDING");
      setSignatureInvalidated(true);
    },
  };

  return (
    <div className="space-y-6">
      {props.mode === "POINTS" ? (
        <StepCertificateForm {...props} {...formCallbacks} />
      ) : props.mode === "TEST_READINGS" ? (
        <StepTestReadingsForm {...props} {...formCallbacks} />
      ) : (
        <StepVerificationForm {...props} {...formCallbacks} />
      )}

      <div id="certificate-signature" className="space-y-4 scroll-mt-24">
        <CertificateSignatureBlock
          reportId={props.reportId}
          certificateId={props.certificateId}
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

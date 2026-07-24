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
import { useStoredCertificate } from "@/lib/offline/repository";
import type { LocalCertState } from "@/lib/offline/db";
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

/** Aplica el estado local (offline) sobre las filas del servidor. */
function overrideRows(
  rows: MeasurementRow[],
  local: LocalCertState | null
): MeasurementRow[] {
  if (!local) return rows;
  return rows.map((row) => {
    const status = local.rowStatus[row.deviceSelectionId];
    return status
      ? {
          ...row,
          status: status.status,
          statusReason: status.statusReason ?? "",
          requiredAdjustment: status.requiredAdjustment,
        }
      : row;
  });
}

export function CertificateStep({
  initialReadyToSign,
  signature,
  nextHref,
  ...props
}: Props) {
  const { t } = useLanguage();
  const stored = useStoredCertificate(props.certificateId);

  // Congela la fuente de valores iniciales (seed del servidor vs. captura local)
  // en la primera resolución de Dexie, para no remontar en cada guardado.
  const [frozen, setFrozen] = useState<{ local: LocalCertState | null } | null>(
    null
  );
  useEffect(() => {
    if (frozen || stored === undefined) return;
    setFrozen({ local: stored?.local ?? null });
  }, [frozen, stored]);
  const source = frozen?.local ?? null;
  const hydrationKey = frozen ? (source ? "local" : "seed") : "seed";

  const [dirty, setDirty] = useState(false);
  const [readyToSign, setReadyToSign] = useState(initialReadyToSign);
  const [signatureInvalidated, setSignatureInvalidated] = useState(false);

  useEffect(() => {
    setReadyToSign(initialReadyToSign);
  }, [initialReadyToSign]);
  useEffect(() => {
    if (source) setReadyToSign(source.overallStatus !== "PENDING");
  }, [source]);

  // Firma vigente: en reportes descargados manda Dexie (refleja la firma
  // capturada offline y la revocación al reeditar); si no, el prop del servidor.
  const storedSignature: ExistingSignature | null =
    stored && stored.signature
      ? {
          signatureImageUrl: stored.signature.signatureImageUrl,
          signedAt: new Date(stored.signature.signedAt),
          signerName: stored.signature.signerName,
          signerTitle: stored.signature.signerTitle,
        }
      : null;
  const baseSignature =
    stored === undefined || stored === null ? signature : storedSignature;
  const signatureVersion = baseSignature?.signedAt.toISOString();

  useEffect(() => {
    setSignatureInvalidated(false);
  }, [signatureVersion]);

  const activeSignature = signatureInvalidated ? null : baseSignature;
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

  const commonFormProps = {
    title: props.title,
    description: props.description,
    reportId: props.reportId,
    certificateId: props.certificateId,
    certificateType: props.certificateType,
  };

  return (
    <div className="space-y-6">
      {props.mode === "POINTS" ? (
        <StepCertificateForm
          key={hydrationKey}
          {...commonFormProps}
          rows={overrideRows(props.rows, source)}
          initialValues={
            (source?.input as UpsertMeasurementInput) ?? props.initialValues
          }
          {...formCallbacks}
        />
      ) : props.mode === "TEST_READINGS" ? (
        <StepTestReadingsForm
          key={hydrationKey}
          {...commonFormProps}
          rows={overrideRows(props.rows, source)}
          initialValues={
            (source?.input as UpsertTestReadingsInput) ?? props.initialValues
          }
          {...formCallbacks}
        />
      ) : (
        <StepVerificationForm
          key={hydrationKey}
          title={props.title}
          description={props.description}
          reportId={props.reportId}
          initialValues={
            (source?.input as UpsertVerificationInput) ?? props.initialValues
          }
          {...formCallbacks}
        />
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

"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { Plus, X } from "lucide-react";
import { updateReportStandards } from "@/server/actions/reports";
import { Button } from "@/components/ui/button";
import {
  getReportStandardsSchema,
  type ReportStandardsInput,
} from "@/lib/validations/reports";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { useLanguage } from "@/components/language-provider";
import { getCertificateLabel } from "@/lib/certificates";
import type { CertificateType, StandardCertificationStatus } from "@prisma/client";
import { WizardFormFooter } from "@/components/wizard/wizard-form-footer";
import { useUnsavedChanges } from "@/components/navigation-protection-provider";

type StandardOption = {
  id: string;
  description: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  certificationStatus: StandardCertificationStatus;
  calibrationCertNumber: string | null;
  calibrationDate: string | null;
  calibrationExpiresAt: string | null;
  expiredForServiceDate: boolean;
  unavailableForReport: boolean;
};

type Props = {
  reportId: string;
  requiredTypes: string[];
  serviceDateLabel: string;
  standards: StandardOption[];
  initialValues: ReportStandardsInput;
};

function standardLabel(standard: StandardOption) {
  return `${standard.description} · ${standard.manufacturer} ${standard.model} · SN ${standard.serialNumber}`;
}

/**
 * Instrumentos que acompañan al principal en una sección. Se manejan como
 * lista de ids en vez de casillas: con el catálogo completo, trece secciones de
 * casillas serían inmanejables.
 */
function AdditionalStandards({
  standards,
  selectedIds,
  primaryId,
  onChange,
}: {
  standards: StandardOption[];
  selectedIds: string[];
  primaryId: string;
  onChange: (ids: string[]) => void;
}) {
  const { t } = useLanguage();
  const [pending, setPending] = useState("");
  const available = standards.filter(
    (standard) =>
      standard.id !== primaryId &&
      !selectedIds.includes(standard.id) &&
      !standard.expiredForServiceDate &&
      !standard.unavailableForReport
  );
  const selected = selectedIds
    .map((id) => standards.find((standard) => standard.id === id))
    .filter((standard): standard is StandardOption => Boolean(standard));

  return (
    <div className="mt-4 border-t pt-3">
      <div className="text-xs font-semibold text-foreground">
        {t("standards.additional")}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("standards.additionalHint")}
      </p>

      {selected.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">{t("standards.noAdditional")}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {selected.map((standard) => (
            <li
              key={standard.id}
              className="flex items-center justify-between gap-3 rounded-lg border bg-muted/50 px-3 py-1.5"
            >
              <span className="technical-id text-xs">{standardLabel(standard)}</span>
              <button
                type="button"
                className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                aria-label={t("standards.removeAdditional", { name: standard.description })}
                onClick={() =>
                  onChange(selectedIds.filter((id) => id !== standard.id))
                }
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {available.length > 0 && (
        <div className="mt-2 flex gap-2">
          <select
            aria-label={t("standards.additional")}
            className="technical-id flex h-9 w-full rounded-lg border border-input bg-white px-3 text-xs"
            value={pending}
            onChange={(event) => setPending(event.target.value)}
          >
            <option value="">{t("standards.select")}</option>
            {available.map((standard) => (
              <option key={standard.id} value={standard.id}>
                {standardLabel(standard)}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            disabled={!pending}
            onClick={() => {
              if (!pending) return;
              onChange([...selectedIds, pending]);
              setPending("");
            }}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            {t("standards.addAdditional")}
          </Button>
        </div>
      )}
    </div>
  );
}

export function StepStandardsForm({
  reportId,
  requiredTypes,
  serviceDateLabel,
  standards,
  initialValues,
}: Props) {
  const { locale, t } = useLanguage();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const form = useForm<ReportStandardsInput>({
    resolver: zodResolver(getReportStandardsSchema(locale)),
    defaultValues: initialValues,
  });
  useUnsavedChanges(form.formState.isDirty);
  const { fields } = useFieldArray({
    control: form.control,
    name: "standards",
  });
  const watchedStandards = useWatch({ control: form.control, name: "standards" });

  function onSubmit(values: ReportStandardsInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await updateReportStandards(values);
      if (result?.ok === false) {
        setServerError(result.message);
      }
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <input type="hidden" value={reportId} {...form.register("reportId")} />

      <Card className="border-0 bg-transparent">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="text-2xl">{t("standards.title")}</CardTitle>
          <CardDescription>
            {t("standards.description", { date: serviceDateLabel })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 px-0">
          {serverError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </div>
          )}

          {requiredTypes.length === 0 ? (
            <div className="rounded-lg border bg-muted/60 p-4 text-sm text-muted-foreground">
              {t("standards.empty")}
            </div>
          ) : (
            <div className="space-y-4">
              {fields.map((field, index) => {
                const type = requiredTypes[index] ?? field.certificateType;
                const error = form.formState.errors.standards?.[index]?.standardInstrumentId;

                return (
                  <div key={field.id} className="rounded-xl border bg-white p-4">
                    <input
                      type="hidden"
                      {...form.register(`standards.${index}.certificateType`)}
                    />
                    <div className="mb-2 text-sm font-semibold">
                      {getCertificateLabel(type as CertificateType, locale)}
                    </div>
                    <label
                      className="mb-1 block text-xs text-muted-foreground"
                      htmlFor={`standard-primary-${index}`}
                    >
                      {t("standards.primary")}
                    </label>
                    <select
                      id={`standard-primary-${index}`}
                      className="technical-id flex h-10 w-full rounded-lg border border-input bg-white px-3 py-1 text-sm"
                      {...form.register(`standards.${index}.standardInstrumentId`)}
                    >
                      <option value="">{t("standards.select")}</option>
                      {standards.map((standard) => (
                        <option
                          key={standard.id}
                          value={standard.id}
                          disabled={
                            standard.expiredForServiceDate ||
                            standard.unavailableForReport
                          }
                        >
                          {standard.description} · {standard.manufacturer} {standard.model} · SN{" "}
                          {standard.serialNumber}
                          {standard.certificationStatus === "CERTIFIED" &&
                          standard.calibrationExpiresAt
                            ? ` · ${t("common.certificateAbbr")} ${standard.calibrationCertNumber} · ${t("common.expires")} ${formatDate(standard.calibrationExpiresAt, locale)}`
                            : standard.certificationStatus === "NOT_APPLICABLE"
                              ? ` · ${t("standardsAdmin.notApplicable")}`
                              : ` · ${t("standardsAdmin.pendingCertification")}`}
                          {standard.expiredForServiceDate ? ` · ${t("common.expired")}` : ""}
                        </option>
                      ))}
                    </select>
                    {error && <p className="mt-1 text-xs text-destructive">{error.message}</p>}

                    <AdditionalStandards
                      standards={standards}
                      primaryId={watchedStandards?.[index]?.standardInstrumentId ?? ""}
                      selectedIds={
                        watchedStandards?.[index]?.additionalStandardInstrumentIds ?? []
                      }
                      onChange={(ids) =>
                        form.setValue(
                          `standards.${index}.additionalStandardInstrumentIds`,
                          ids,
                          { shouldDirty: true }
                        )
                      }
                    />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <WizardFormFooter
        previousHref={`/reports/${reportId}/wizard/devices`}
        pending={isPending}
        submitLabel={t("standards.finish")}
      />
    </form>
  );
}

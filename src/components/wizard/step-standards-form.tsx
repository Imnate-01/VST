"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { updateReportStandards } from "@/server/actions/reports";
import {
  getReportStandardsSchema,
  type ReportStandardsInput,
} from "@/lib/validations/reports";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { useLanguage } from "@/components/language-provider";
import { getCertificateLabel } from "@/lib/certificates";
import type { CertificateType } from "@prisma/client";

type StandardOption = {
  id: string;
  description: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  calibrationCertNumber: string;
  calibrationDate: string;
  calibrationExpiresAt: string;
  expiredForServiceDate: boolean;
};

type Props = {
  reportId: string;
  requiredTypes: string[];
  serviceDateLabel: string;
  standards: StandardOption[];
  initialValues: ReportStandardsInput;
};

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
  const { fields } = useFieldArray({
    control: form.control,
    name: "standards",
  });

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

      <Card>
        <CardHeader>
          <CardTitle>{t("standards.title")}</CardTitle>
          <CardDescription>
            {t("standards.description", { date: serviceDateLabel })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {serverError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </div>
          )}

          {requiredTypes.length === 0 ? (
            <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
              {t("standards.empty")}
            </div>
          ) : (
            <div className="space-y-4">
              {fields.map((field, index) => {
                const type = requiredTypes[index] ?? field.certificateType;
                const error = form.formState.errors.standards?.[index]?.standardInstrumentId;

                return (
                  <div key={field.id} className="rounded-lg border p-4">
                    <input
                      type="hidden"
                      {...form.register(`standards.${index}.certificateType`)}
                    />
                    <div className="mb-2 text-sm font-semibold">
                      {getCertificateLabel(type as CertificateType, locale)}
                    </div>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      {...form.register(`standards.${index}.standardInstrumentId`)}
                    >
                      <option value="">{t("standards.select")}</option>
                      {standards.map((standard) => (
                        <option
                          key={standard.id}
                          value={standard.id}
                          disabled={standard.expiredForServiceDate}
                        >
                          {standard.description} · {standard.manufacturer} {standard.model} · SN{" "}
                          {standard.serialNumber} · {t("common.certificateAbbr")} {standard.calibrationCertNumber} · {t("common.expires")} {" "}
                          {formatDate(standard.calibrationExpiresAt, locale)}
                          {standard.expiredForServiceDate ? ` · ${t("common.expired")}` : ""}
                        </option>
                      ))}
                    </select>
                    {error && <p className="mt-1 text-xs text-destructive">{error.message}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? t("common.saving") : t("standards.finish")}
        </Button>
      </div>
    </form>
  );
}

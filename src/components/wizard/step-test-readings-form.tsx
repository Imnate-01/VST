"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { CertificateType, MeasurementStatus } from "@prisma/client";
import { Check, Clock3, X } from "lucide-react";
import { upsertTestReadings } from "@/server/actions/measurements";
import {
  getUpsertTestReadingsSchema,
  type UpsertTestReadingsInput,
} from "@/lib/validations/measurements";
import {
  certificateHref,
  implementedCertificateTypes,
} from "@/lib/certificates";
import type { MeasurementRow } from "@/components/wizard/step-certificate-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MeasurementStatusBadge } from "@/components/report/measurement-status-badge";
import { WizardFormFooter } from "@/components/wizard/wizard-form-footer";
import { useLanguage } from "@/components/language-provider";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  description: string;
  reportId: string;
  certificateId: string;
  certificateType: CertificateType;
  rows: MeasurementRow[];
  initialValues: UpsertTestReadingsInput;
  onDirtyChange?: (dirty: boolean) => void;
  onSaved?: (status: "PENDING" | "PASS" | "FAIL" | "MIXED") => void;
};

function number(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function format(value: number): string {
  return value.toFixed(4).replace(/\.?0+$/, "");
}

function Status({
  status,
}: {
  status: "PENDING" | "PASS" | "FAIL";
}) {
  const { t } = useLanguage();
  const Icon = status === "PASS" ? Check : status === "FAIL" ? X : Clock3;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold",
        status === "PASS" && "bg-success-muted text-success",
        status === "FAIL" && "bg-destructive/5 text-destructive",
        status === "PENDING" && "bg-muted text-muted-foreground"
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {status === "PASS"
        ? t("measurement.pass")
        : status === "FAIL"
          ? t("measurement.fail")
          : t("measurement.pending")}
    </span>
  );
}

export function StepTestReadingsForm({
  title,
  description,
  reportId,
  certificateType,
  rows,
  initialValues,
  onDirtyChange,
  onSaved,
}: Props) {
  const { locale, t } = useLanguage();
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const form = useForm<UpsertTestReadingsInput>({
    resolver: zodResolver(getUpsertTestReadingsSchema(locale)),
    defaultValues: initialValues,
  });
  const watchedParams = useWatch({ control: form.control, name: "params" });
  const watchedMeasurements = useWatch({
    control: form.control,
    name: "measurements",
  });
  const isDirty = form.formState.isDirty;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const target =
    certificateType === CertificateType.ULTRASONIC
      ? number(watchedParams?.targetWeight)
      : (() => {
          const rate = number(watchedParams?.meteringRate);
          const duration = number(watchedParams?.durationMinutes);
          return rate === null || duration === null ? null : rate * duration;
        })();

  const savedSummary = useMemo(
    () => ({
      pass: rows.filter((row) => row.status === MeasurementStatus.PASS).length,
      fail: rows.filter((row) => row.status === MeasurementStatus.FAIL).length,
      pending: rows.filter(
        (row) => row.status === MeasurementStatus.PENDING
      ).length,
    }),
    [rows]
  );

  function onSubmit(values: UpsertTestReadingsInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await upsertTestReadings(values);
      if (result?.ok === false) {
        setServerError(result.message ?? t("common.unexpectedError"));
        return;
      }
      form.reset(values);
      if (result?.certificateStatus) onSaved?.(result.certificateStatus);
      router.refresh();
      if (result?.certificateStatus !== "PENDING") {
        document
          .getElementById("certificate-signature")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  }

  const certificateIndex = implementedCertificateTypes.indexOf(certificateType);
  const previousCertificate =
    certificateIndex > 0
      ? implementedCertificateTypes[certificateIndex - 1]
      : undefined;
  const previousHref = previousCertificate
    ? certificateHref(reportId, previousCertificate)
    : `/reports/${reportId}/wizard/standards`;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <input type="hidden" {...form.register("reportId")} />
      <input type="hidden" {...form.register("certificateId")} />
      <input type="hidden" {...form.register("certificateType")} />

      <Card className="border-0 bg-transparent">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 px-0">
          {serverError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <MeasurementStatusBadge status="PASS" />
            <span>{t("measurement.savedPass", { count: savedSummary.pass })}</span>
            <MeasurementStatusBadge status="FAIL" />
            <span>{t("measurement.savedFail", { count: savedSummary.fail })}</span>
            <MeasurementStatusBadge status="PENDING" />
            <span>
              {t("measurement.savedPending", { count: savedSummary.pending })}
            </span>
          </div>

          <section className="rounded-xl border bg-white p-5">
            <h3 className="text-sm font-semibold">
              {t("testReadings.parameters")}
            </h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {certificateType === CertificateType.ULTRASONIC ? (
                <label className="space-y-1 text-sm">
                  <span className="font-medium">
                    {t("testReadings.targetWeight")}
                  </span>
                  <input
                    inputMode="decimal"
                    className="h-10 w-full rounded-lg border border-input px-3"
                    {...form.register("params.targetWeight")}
                  />
                </label>
              ) : (
                <>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">
                      {t("testReadings.meteringRate")}
                    </span>
                    <input
                      inputMode="decimal"
                      className="h-10 w-full rounded-lg border border-input px-3"
                      {...form.register("params.meteringRate")}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">
                      {t("testReadings.duration")}
                    </span>
                    <input
                      inputMode="decimal"
                      className="h-10 w-full rounded-lg border border-input px-3"
                      {...form.register("params.durationMinutes")}
                    />
                  </label>
                </>
              )}
              <label className="space-y-1 text-sm md:col-span-2">
                <span className="font-medium">{t("testReadings.material")}</span>
                <input
                  className="h-10 w-full rounded-lg border border-input px-3"
                  {...form.register("params.material")}
                />
              </label>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {t("testReadings.targetPreview", {
                target: target === null ? "—" : `${format(target)} g`,
              })}
            </p>
          </section>

          <div className="grid gap-5 xl:grid-cols-2">
            {rows.map((row, measurementIndex) => {
              const tolerance = number(row.toleranceValue);
              const absoluteTolerance =
                target === null || tolerance === null
                  ? null
                  : row.toleranceIsPercent
                    ? (Math.abs(target) * tolerance) / 100
                    : Math.abs(tolerance);

              return (
                <section
                  key={row.deviceSelectionId}
                  className="overflow-hidden rounded-xl border bg-white"
                >
                  <input
                    type="hidden"
                    {...form.register(
                      `measurements.${measurementIndex}.deviceSelectionId`
                    )}
                  />
                  <div className="flex items-start justify-between gap-3 bg-primary px-4 py-3 text-white">
                    <div>
                      <div className="technical-id text-xs font-bold">
                        {row.tagNumber}
                      </div>
                      <div className="mt-1 text-sm font-semibold">
                        {row.description}
                      </div>
                    </div>
                    <MeasurementStatusBadge status={row.status} />
                  </div>
                  <div className="divide-y">
                    <div className="grid grid-cols-[1fr_auto] gap-3 px-4 py-3 text-sm">
                      <span className="text-muted-foreground">
                        {t("testReadings.target")}
                      </span>
                      <span className="technical-id font-semibold">
                        {target === null ? "—" : `${format(target)} g`}
                      </span>
                    </div>
                    {initialValues.measurements[
                      measurementIndex
                    ]?.readings.map((reading, readingIndex) => {
                      const value = number(
                        watchedMeasurements?.[measurementIndex]?.readings?.[
                          readingIndex
                        ]?.value
                      );
                      const deviation =
                        value === null || target === null
                          ? null
                          : value - target;
                      const status =
                        deviation === null || absoluteTolerance === null
                          ? "PENDING"
                          : Math.abs(deviation) <= absoluteTolerance
                            ? "PASS"
                            : "FAIL";

                      return (
                        <div
                          key={reading.sequence}
                          className="grid grid-cols-[88px_1fr_auto] items-center gap-3 px-4 py-3"
                        >
                          <input
                            type="hidden"
                            {...form.register(
                              `measurements.${measurementIndex}.readings.${readingIndex}.sequence`,
                              { valueAsNumber: true }
                            )}
                          />
                          <span className="text-sm font-semibold">
                            {t("testReadings.testNumber", {
                              number: reading.sequence,
                            })}
                          </span>
                          <input
                            inputMode="decimal"
                            placeholder="g"
                            className="h-9 min-w-0 rounded-lg border border-input bg-muted/70 px-3 text-right font-medium"
                            {...form.register(
                              `measurements.${measurementIndex}.readings.${readingIndex}.value`
                            )}
                          />
                          <div className="min-w-24 text-right">
                            <Status status={status} />
                            <div className="mt-1 text-xs text-muted-foreground">
                              Δ {deviation === null ? "—" : `${format(deviation)} g`}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>

          <section className="rounded-xl border bg-white p-5">
            <label htmlFor="test-notes" className="text-sm font-semibold">
              {t("certificate.observations")}
            </label>
            <textarea
              id="test-notes"
              rows={4}
              className="mt-3 w-full rounded-lg border border-input bg-muted/70 px-3 py-2 text-sm"
              {...form.register("notes")}
            />
          </section>
        </CardContent>
      </Card>

      <WizardFormFooter
        previousHref={previousHref}
        pending={isPending}
        disabled={rows.length === 0}
        submitLabel={t("common.save")}
        hint={t("certificate.saveToSign")}
      />
    </form>
  );
}

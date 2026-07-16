"use client";

import { useMemo, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { updateReportInfo } from "@/server/actions/reports";
import { getReportInfoSchema, type ReportInfoInput } from "@/lib/validations/reports";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/components/language-provider";
import { WizardFormFooter } from "@/components/wizard/wizard-form-footer";

type FillerOption = {
  id: string;
  serialNumber: string;
  clientName: string;
  clientAddress: string;
  clientCity: string;
  clientState: string;
  clientZip: string;
  modelName: string;
};

type Props = {
  preparedByName: string;
  reportNumber: string;
  initialValues: ReportInfoInput;
  fillers: FillerOption[];
};

export function StepInfoForm({ preparedByName, reportNumber, initialValues, fillers }: Props) {
  const { locale, t } = useLanguage();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const form = useForm<ReportInfoInput>({
    resolver: zodResolver(getReportInfoSchema(locale)),
    defaultValues: initialValues,
  });
  const selectedFillerId = form.watch("fillerId");
  const selectedFiller = useMemo(
    () => fillers.find((filler) => filler.id === selectedFillerId),
    [fillers, selectedFillerId]
  );

  function onSubmit(values: ReportInfoInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await updateReportInfo(values);
      if (result?.ok === false) {
        setServerError(result.message);
      }
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <input type="hidden" {...form.register("reportId")} />

      <section>
        <h2 className="text-2xl font-semibold text-foreground">{t("info.title")}</h2>
        <p className="mt-2 text-muted-foreground">{t("info.description")}</p>

        {serverError && (
          <div className="mt-6 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {serverError}
          </div>
        )}

        <dl className="mt-8 grid overflow-hidden rounded-xl border bg-white sm:grid-cols-2">
          <div className="border-b p-5 sm:border-r">
            <dt className="text-sm text-muted-foreground">{t("info.preparedBy")}</dt>
            <dd className="mt-1 font-semibold text-foreground">{preparedByName}</dd>
          </div>
          <div className="border-b p-5">
            <dt className="text-sm text-muted-foreground">{t("info.reportNumber")}</dt>
            <dd className="technical-id mt-1 font-semibold text-foreground">{reportNumber}</dd>
          </div>
          <div className="border-b p-5 sm:border-b-0 sm:border-r">
            <dt className="text-sm text-muted-foreground">{t("info.client")}</dt>
            <dd className="mt-1 font-semibold text-foreground">
              {selectedFiller
                ? `${selectedFiller.clientName} — ${selectedFiller.clientCity}`
                : "—"}
            </dd>
          </div>
          <div className="p-5">
            <dt className="text-sm text-muted-foreground">{t("info.filler")}</dt>
            <dd className="mt-1">
              <select
                aria-label={t("info.filler")}
                className="technical-id -ml-2 h-9 max-w-full rounded-md border border-transparent bg-transparent px-2 font-semibold text-foreground outline-none transition-colors hover:border-input focus:border-primary focus:ring-2 focus:ring-primary/20"
                {...form.register("fillerId")}
              >
                {fillers.map((filler) => (
                  <option key={filler.id} value={filler.id}>
                    {filler.modelName} · SN {filler.serialNumber}
                  </option>
                ))}
              </select>
              {form.formState.errors.fillerId && (
                <p className="mt-1 text-xs text-destructive">
                  {form.formState.errors.fillerId.message}
                </p>
              )}
            </dd>
          </div>
        </dl>

        <div className="mt-8 grid gap-6 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1.5fr)]">
          <div className="space-y-2">
            <Label htmlFor="serviceDate">{t("report.serviceDate")}</Label>
            <Input id="serviceDate" type="date" {...form.register("serviceDate")} />
            {form.formState.errors.serviceDate && (
              <p className="text-xs text-destructive">
                {form.formState.errors.serviceDate.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="observations">{t("info.observations")}</Label>
            <textarea
              id="observations"
              rows={5}
              className="flex min-h-32 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/25"
              placeholder={t("info.observationsPlaceholder")}
              {...form.register("observations")}
            />
            {form.formState.errors.observations && (
              <p className="text-xs text-destructive">
                {form.formState.errors.observations.message}
              </p>
            )}
          </div>
        </div>
      </section>

      <WizardFormFooter
        previousHref="/reports"
        pending={isPending}
        submitLabel={t("common.saveContinue")}
      />
    </form>
  );
}

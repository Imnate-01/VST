"use client";

import { useMemo, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { updateReportInfo } from "@/server/actions/reports";
import { getReportInfoSchema, type ReportInfoInput } from "@/lib/validations/reports";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/components/language-provider";

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
  initialValues: ReportInfoInput;
  fillers: FillerOption[];
};

export function StepInfoForm({ initialValues, fillers }: Props) {
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
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <input type="hidden" {...form.register("reportId")} />

      <Card>
        <CardHeader>
          <CardTitle>{t("info.title")}</CardTitle>
          <CardDescription>
            {t("info.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {serverError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </div>
          )}

          <div className="grid gap-5 md:grid-cols-2">
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
              <Label htmlFor="fillerId">{t("info.filler")}</Label>
              <select
                id="fillerId"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                {...form.register("fillerId")}
              >
                {fillers.map((filler) => (
                  <option key={filler.id} value={filler.id}>
                    {filler.clientName} · {filler.modelName} #{filler.serialNumber}
                  </option>
                ))}
              </select>
              {form.formState.errors.fillerId && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.fillerId.message}
                </p>
              )}
            </div>
          </div>

          {selectedFiller && (
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="mb-3 text-sm font-medium">{t("info.clientPreview")}</div>
              <dl className="grid gap-3 text-sm md:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">{t("info.client")}</dt>
                  <dd className="font-medium">{selectedFiller.clientName}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("info.modelSerial")}</dt>
                  <dd className="font-medium">
                    {selectedFiller.modelName} #{selectedFiller.serialNumber}
                  </dd>
                </div>
                <div className="md:col-span-2">
                  <dt className="text-muted-foreground">{t("info.address")}</dt>
                  <dd className="font-medium">
                    {selectedFiller.clientAddress}, {selectedFiller.clientCity},{" "}
                    {selectedFiller.clientState} {selectedFiller.clientZip}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="observations">{t("info.observations")}</Label>
            <textarea
              id="observations"
              rows={4}
              className="flex min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder={t("info.observationsPlaceholder")}
              {...form.register("observations")}
            />
            {form.formState.errors.observations && (
              <p className="text-xs text-destructive">
                {form.formState.errors.observations.message}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? t("common.saving") : t("common.saveContinue")}
        </Button>
      </div>
    </form>
  );
}

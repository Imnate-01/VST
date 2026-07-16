"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { updateDeviceSelections } from "@/server/actions/reports";
import {
  getDeviceSelectionSchema,
  type DeviceSelectionInput,
} from "@/lib/validations/reports";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/language-provider";
import { WizardFormFooter } from "@/components/wizard/wizard-form-footer";

type DeviceRow = {
  id: string;
  tagNumber: string;
  description: string;
  deviceType: string;
  tolerance: string;
  certificateType: string;
};

type Props = {
  reportId: string;
  devices: DeviceRow[];
  initialValues: DeviceSelectionInput;
};

export function StepDevicesForm({ reportId, devices, initialValues }: Props) {
  const { locale, t } = useLanguage();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const form = useForm<DeviceSelectionInput>({
    resolver: zodResolver(getDeviceSelectionSchema(locale)),
    defaultValues: initialValues,
  });
  const { fields } = useFieldArray({
    control: form.control,
    name: "selections",
  });
  const selections = useWatch({ control: form.control, name: "selections" });

  function onSubmit(values: DeviceSelectionInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await updateDeviceSelections(values);
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
          <CardTitle className="text-2xl">{t("devices.title")}</CardTitle>
          <CardDescription>
            {t("devices.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-0">
          {serverError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </div>
          )}

          <div className="table-shell">
            <table className="table-modern min-w-[980px]">
              <thead>
                <tr>
                  <th className="w-20">{t("devices.included")}</th>
                  <th>{t("devices.tag")}</th>
                  <th>{t("devices.descriptionColumn")}</th>
                  <th>{t("devices.type")}</th>
                  <th>{t("devices.tolerance")}</th>
                  <th>{t("devices.certificate")}</th>
                  <th className="w-72">{t("devices.exclusionReason")}</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field, index) => {
                  const device = devices[index];
                  const included = selections?.[index]?.included ?? true;
                  const error = form.formState.errors.selections?.[index]?.exclusionReason;

                  if (!device) return null;

                  return (
                    <tr
                      key={field.id}
                      className={cn(!included && "opacity-60 grayscale-[0.4]")}
                    >
                      <td>
                        <input
                          type="hidden"
                          {...form.register(`selections.${index}.deviceCatalogId`)}
                        />
                        <input
                          type="checkbox"
                          className="h-4 w-4 cursor-pointer rounded border-input accent-primary"
                          {...form.register(`selections.${index}.included`)}
                        />
                      </td>
                      <td className="tabular font-semibold text-foreground">
                        {device.tagNumber}
                      </td>
                      <td>{device.description}</td>
                      <td>
                        <span className="inline-flex rounded-md border bg-muted px-2 py-0.5 text-xs font-semibold text-foreground">
                          {device.deviceType}
                        </span>
                      </td>
                      <td className="tabular whitespace-nowrap">{device.tolerance}</td>
                      <td className="text-xs text-muted-foreground">
                        {device.certificateType}
                      </td>
                      <td>
                        <Input
                          placeholder={
                            included ? t("common.notApplicable") : t("devices.reasonRequired")
                          }
                          disabled={included}
                          {...form.register(`selections.${index}.exclusionReason`)}
                        />
                        {error && (
                          <p className="mt-1 text-xs text-destructive">{error.message}</p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <WizardFormFooter
        previousHref={`/reports/${reportId}/wizard/info`}
        pending={isPending}
        disabled={devices.length === 0}
        submitLabel={t("common.saveContinue")}
      />
    </form>
  );
}

"use client";

import { useMemo, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { Plus } from "lucide-react";
import { updateDeviceSelections } from "@/server/actions/reports";
import {
  getDeviceSelectionSchema,
  type DeviceSelectionInput,
} from "@/lib/validations/reports";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/language-provider";
import { NewDeviceDialog, type NewDeviceRow } from "@/components/wizard/new-device-dialog";
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
  const [feedback, setFeedback] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  // Sensores dados de alta en esta pantalla. Se agregan al final, igual que en
  // el catálogo (displayOrder máximo + 1), y desaparecen de acá en cuanto el
  // servidor los devuelve dentro de `devices`.
  const [createdDevices, setCreatedDevices] = useState<DeviceRow[]>([]);
  const form = useForm<DeviceSelectionInput>({
    resolver: zodResolver(getDeviceSelectionSchema(locale)),
    defaultValues: initialValues,
  });
  const { fields, append } = useFieldArray({
    control: form.control,
    name: "selections",
  });
  const selections = useWatch({ control: form.control, name: "selections" });

  const rows = useMemo(() => {
    const knownIds = new Set(devices.map((device) => device.id));
    return [...devices, ...createdDevices.filter((device) => !knownIds.has(device.id))];
  }, [createdDevices, devices]);

  const includedCount = fields.reduce(
    (total, _field, index) => total + (selections?.[index]?.included ? 1 : 0),
    0
  );
  const allIncluded = fields.length > 0 && includedCount === fields.length;
  const someIncluded = includedCount > 0;

  function toggleAll(included: boolean) {
    fields.forEach((_field, index) => {
      form.setValue(`selections.${index}.included`, included, { shouldDirty: true });
    });
    form.clearErrors("selections");
  }

  function handleCreated(device: NewDeviceRow) {
    setCreatedDevices((current) => [...current, device]);
    append({ deviceCatalogId: device.id, included: true, exclusionReason: "" });
    setFeedback(t("devices.sensorCreated"));
  }

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
    <>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <input type="hidden" value={reportId} {...form.register("reportId")} />

        <Card className="border-0 bg-transparent">
          <CardHeader className="flex flex-col gap-4 px-0 pt-0 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-2xl">{t("devices.title")}</CardTitle>
              <CardDescription>
                {t("devices.description")}
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              onClick={() => {
                setFeedback(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              {t("devices.newSensor")}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4 px-0">
            {serverError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {serverError}
              </div>
            )}

            {feedback && (
              <div
                className="rounded-md border border-success/25 bg-success-muted px-3 py-2 text-sm text-success"
                role="status"
              >
                {feedback}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  className="h-4 w-4 cursor-pointer rounded border-input accent-primary"
                  checked={allIncluded}
                  disabled={fields.length === 0}
                  ref={(element) => {
                    if (element) element.indeterminate = someIncluded && !allIncluded;
                  }}
                  onChange={(event) => toggleAll(event.target.checked)}
                />
                {allIncluded ? t("devices.clearAll") : t("devices.selectAll")}
              </label>
              <span className="text-xs text-muted-foreground">
                {t("devices.selectAllHint", { count: includedCount, total: fields.length })}
              </span>
            </div>

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
                    const device = rows[index];
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
                            aria-label={`${t("devices.included")}: ${device.tagNumber}`}
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
          disabled={rows.length === 0}
          submitLabel={t("common.saveContinue")}
        />
      </form>

      {/* Fuera del <form> del checklist: el diálogo tiene su propio form y en
          React los eventos de un portal burbujean por el árbol, no por el DOM. */}
      <NewDeviceDialog
        reportId={reportId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={handleCreated}
      />
    </>
  );
}

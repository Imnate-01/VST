"use client";

import { useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { DeviceType, type CertificateType } from "@prisma/client";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/components/language-provider";
import { getCertificateLabel, implementedCertificateTypes } from "@/lib/certificates";
import type { MessageKey } from "@/lib/i18n";
import { registerChecklistDevice } from "@/server/actions/reports";

export type NewDeviceRow = {
  id: string;
  tagNumber: string;
  description: string;
  deviceType: string;
  tolerance: string;
  certificateType: string;
};

const deviceTypeKeys: Record<DeviceType, MessageKey> = {
  [DeviceType.RTD]: "deviceType.RTD",
  [DeviceType.PS]: "deviceType.PS",
  [DeviceType.FM]: "deviceType.FM",
  [DeviceType.HS]: "deviceType.HS",
  [DeviceType.US]: "deviceType.US",
  [DeviceType.MOT]: "deviceType.MOT",
};

const emptyValues = {
  tagNumber: "",
  description: "",
  deviceType: DeviceType.RTD as DeviceType,
  toleranceValue: "",
  toleranceUnit: "",
  toleranceIsPercent: false,
};

export function NewDeviceDialog({
  reportId,
  open,
  onOpenChange,
  onCreated,
}: {
  reportId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (device: NewDeviceRow) => void;
}) {
  const { locale, t } = useLanguage();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState(emptyValues);
  const [certificateTypes, setCertificateTypes] = useState<CertificateType[]>([]);

  function field<K extends keyof typeof values>(name: K, value: (typeof values)[K]) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  function toggleCertificate(type: CertificateType, checked: boolean) {
    setCertificateTypes((current) =>
      checked ? [...current, type] : current.filter((value) => value !== type)
    );
  }

  function reset() {
    setValues(emptyValues);
    setCertificateTypes([]);
    setError(null);
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[1px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border bg-white p-6 shadow-xl sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-2xl font-semibold">
                {t("devices.newSensorTitle")}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                {t("devices.newSensorDescription")}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button type="button" variant="ghost" size="icon" aria-label={t("common.cancel")}>
                <X className="h-5 w-5" />
              </Button>
            </Dialog.Close>
          </div>

          <form
            className="mt-7 grid gap-5 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              setError(null);
              startTransition(async () => {
                const result = await registerChecklistDevice({
                  reportId,
                  ...values,
                  certificateTypes,
                });
                if (!result.ok) {
                  setError(result.message);
                  return;
                }
                onCreated(result.device);
                reset();
                onOpenChange(false);
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="new-device-tag">{t("devices.tag")}</Label>
              <Input
                id="new-device-tag"
                value={values.tagNumber}
                onChange={(event) => field("tagNumber", event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-device-type">{t("devices.type")}</Label>
              <select
                id="new-device-type"
                value={values.deviceType}
                onChange={(event) => field("deviceType", event.target.value as DeviceType)}
                className="flex h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {Object.values(DeviceType).map((type) => (
                  <option key={type} value={type}>
                    {t(deviceTypeKeys[type])}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="new-device-description">{t("devices.descriptionColumn")}</Label>
              <Input
                id="new-device-description"
                value={values.description}
                onChange={(event) => field("description", event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-device-tolerance">{t("devices.toleranceValue")}</Label>
              <Input
                id="new-device-tolerance"
                type="number"
                step="any"
                min="0"
                inputMode="decimal"
                placeholder="0.5"
                value={values.toleranceValue}
                onChange={(event) => field("toleranceValue", event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-device-unit">{t("devices.toleranceUnit")}</Label>
              <Input
                id="new-device-unit"
                placeholder="°C"
                value={values.toleranceUnit}
                onChange={(event) => field("toleranceUnit", event.target.value)}
                required
              />
            </div>

            <label className="flex items-center gap-3 sm:col-span-2">
              <input
                type="checkbox"
                className="h-4 w-4 cursor-pointer rounded border-input accent-primary"
                checked={values.toleranceIsPercent}
                onChange={(event) => field("toleranceIsPercent", event.target.checked)}
              />
              <span className="text-sm font-semibold">{t("devices.tolerancePercent")}</span>
            </label>

            <fieldset className="space-y-3 border-t pt-5 sm:col-span-2">
              <legend className="sr-only">{t("devices.certificates")}</legend>
              <div>
                <p className="text-sm font-semibold">{t("devices.certificates")}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("devices.certificatesHint")}
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {implementedCertificateTypes.map((type) => (
                  <label key={type} className="flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 cursor-pointer rounded border-input accent-primary"
                      checked={certificateTypes.includes(type)}
                      onChange={(event) => toggleCertificate(type, event.target.checked)}
                    />
                    <span>{getCertificateLabel(type, locale)}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {error && (
              <p
                className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive sm:col-span-2"
                role="alert"
              >
                {error}
              </p>
            )}

            <div className="flex justify-end gap-3 border-t pt-5 sm:col-span-2">
              <Dialog.Close asChild>
                <Button type="button" variant="outline" disabled={pending}>
                  {t("common.cancel")}
                </Button>
              </Dialog.Close>
              <Button type="submit" disabled={pending || certificateTypes.length === 0}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("common.save")}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

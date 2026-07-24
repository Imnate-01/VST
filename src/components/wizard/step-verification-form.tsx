"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { CertificateType } from "@prisma/client";
import { upsertVerification } from "@/server/actions/measurements";
import {
  getUpsertVerificationSchema,
  type UpsertVerificationInput,
} from "@/lib/validations/measurements";
import {
  certificateHref,
  implementedCertificateTypes,
} from "@/lib/certificates";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WizardFormFooter } from "@/components/wizard/wizard-form-footer";
import { useLanguage } from "@/components/language-provider";

type Props = {
  title: string;
  description: string;
  reportId: string;
  initialValues: UpsertVerificationInput;
  onDirtyChange?: (dirty: boolean) => void;
  onSaved?: (status: "PENDING" | "PASS" | "FAIL" | "MIXED") => void;
};

export function StepVerificationForm({
  title,
  description,
  reportId,
  initialValues,
  onDirtyChange,
  onSaved,
}: Props) {
  const { locale, t } = useLanguage();
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const form = useForm<UpsertVerificationInput>({
    resolver: zodResolver(getUpsertVerificationSchema(locale)),
    defaultValues: initialValues,
  });
  const watchedRows = useWatch({ control: form.control, name: "rows" });
  const isDirty = form.formState.isDirty;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  function onSubmit(values: UpsertVerificationInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await upsertVerification(values);
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

  const certificateIndex =
    implementedCertificateTypes.indexOf(CertificateType.EXHAUST);
  const previousCertificate =
    certificateIndex > 0
      ? implementedCertificateTypes[certificateIndex - 1]
      : undefined;
  const previousHref = previousCertificate
    ? certificateHref(reportId, previousCertificate)
    : `/reports/${reportId}/wizard/standards`;

  const grouped = initialValues.rows.reduce<
    Array<{ key: string; indexes: number[] }>
  >((groups, row, index) => {
    const key = `${row.motorTag}:${row.description}`;
    const existing = groups.find((group) => group.key === key);
    if (existing) existing.indexes.push(index);
    else groups.push({ key, indexes: [index] });
    return groups;
  }, []);

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

          <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
            {t("verification.referenceOnly")}
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            {grouped.map((group) => {
              const first = initialValues.rows[group.indexes[0]!]!;
              return (
                <section
                  key={group.key}
                  className="overflow-hidden rounded-xl border bg-white"
                >
                  <div className="bg-primary px-4 py-3 text-white">
                    <div className="technical-id text-xs font-bold">
                      {first.motorTag}
                    </div>
                    <div className="mt-1 text-sm font-semibold">
                      {first.description}
                    </div>
                  </div>
                  <div className="divide-y">
                    {group.indexes.map((rowIndex) => {
                      const row = initialValues.rows[rowIndex]!;
                      const notApplicable =
                        watchedRows?.[rowIndex]?.notApplicable ?? false;

                      return (
                        <div
                          key={`${row.motorTag}:${row.rowLabel}`}
                          className="space-y-3 p-4"
                        >
                          <input
                            type="hidden"
                            {...form.register(`rows.${rowIndex}.motorTag`)}
                          />
                          <input
                            type="hidden"
                            {...form.register(`rows.${rowIndex}.description`)}
                          />
                          <input
                            type="hidden"
                            {...form.register(`rows.${rowIndex}.rowLabel`)}
                          />
                          <input
                            type="hidden"
                            {...form.register(`rows.${rowIndex}.displayOrder`, {
                              valueAsNumber: true,
                            })}
                          />
                          <div className="text-sm font-semibold">
                            {row.rowLabel}
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="space-y-1 text-sm">
                              <span className="text-muted-foreground">
                                {t("verification.scfm")}
                              </span>
                              <input
                                inputMode="decimal"
                                className="h-10 w-full rounded-lg border border-input bg-muted/70 px-3 text-right"
                                {...form.register(`rows.${rowIndex}.scfm`)}
                              />
                            </label>
                            <label className="space-y-1 text-sm">
                              <span className="text-muted-foreground">
                                {t("verification.driveFrequency")}
                              </span>
                              <input
                                inputMode="decimal"
                                disabled={notApplicable}
                                className="h-10 w-full rounded-lg border border-input bg-muted/70 px-3 text-right disabled:bg-muted disabled:text-muted-foreground"
                                {...form.register(
                                  `rows.${rowIndex}.driveFrequencyHz`
                                )}
                              />
                            </label>
                          </div>
                          <label className="flex items-center gap-2 text-sm text-muted-foreground">
                            <input
                              type="checkbox"
                              {...form.register(
                                `rows.${rowIndex}.notApplicable`
                              )}
                            />
                            {t("verification.frequencyNotApplicable")}
                          </label>
                          <label
                            htmlFor={`verification-notes-${rowIndex}`}
                            className="block space-y-1 text-sm"
                          >
                            <span className="font-medium text-foreground">
                              {t("certificate.observations")}
                            </span>
                            <textarea
                              id={`verification-notes-${rowIndex}`}
                              rows={3}
                              placeholder={t("certificate.observationsPlaceholder")}
                              className="w-full rounded-lg border border-input bg-muted/70 px-3 py-2 text-sm"
                              {...form.register(`rows.${rowIndex}.notes`)}
                            />
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>

        </CardContent>
      </Card>

      <WizardFormFooter
        previousHref={previousHref}
        pending={isPending}
        submitLabel={t("common.save")}
        hint={t("certificate.saveToSign")}
      />
    </form>
  );
}

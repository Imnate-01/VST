"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { CertificateType, MeasurementStatus, PointKind } from "@prisma/client";
import { Check, Clock3, TriangleAlert, X } from "lucide-react";
import { upsertMeasurement } from "@/server/actions/measurements";
import {
  getUpsertMeasurementSchema,
  type UpsertMeasurementInput,
} from "@/lib/validations/measurements";
import {
  getCertificateConfig,
  getConditionLabel,
  getMeasuredQuantity,
  getPointKindLabel,
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
import { MeasurementStatusBadge } from "@/components/report/measurement-status-badge";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/language-provider";
import { WizardFormFooter } from "@/components/wizard/wizard-form-footer";

export type MeasurementRow = {
  deviceSelectionId: string;
  tagNumber: string;
  description: string;
  tolerance: string;
  toleranceValue: string;
  toleranceIsPercent: boolean;
  toleranceUnit: string;
  status: MeasurementStatus;
  statusReason: string;
  requiredAdjustment: boolean;
};

type Props = {
  title: string;
  description: string;
  reportId: string;
  certificateId: string;
  certificateType: CertificateType;
  rows: MeasurementRow[];
  initialValues: UpsertMeasurementInput;
  onDirtyChange?: (dirty: boolean) => void;
  onSaved?: (status: "PENDING" | "PASS" | "FAIL" | "MIXED") => void;
};

type PointStatus = "PASS" | "FAIL" | "PENDING";
type PointValues = UpsertMeasurementInput["measurements"][number]["points"][number];

function cleanUnit(unit: string) {
  return unit.replace("Â°C", "°C").replace("Â°", "°");
}

function parseNumeric(value: string | undefined) {
  if (!value?.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value: number) {
  return value.toFixed(4).replace(/\.?0+$/, "");
}

/**
 * Preview en vivo, en float, solo para orientar la captura. El cálculo oficial
 * lo hace el servidor con Decimal.
 *
 * deviation = reading - reference. La tolerancia porcentual se calcula sobre la
 * referencia (el valor verdadero del patrón).
 */
function evalPass(params: {
  reference?: string;
  reading?: string;
  toleranceValue: string;
  toleranceIsPercent: boolean;
}) {
  const reference = parseNumeric(params.reference);
  const reading = parseNumeric(params.reading);
  const tolerance = parseNumeric(params.toleranceValue);

  if (reference === null || reading === null || tolerance === null) {
    return { deviation: "", status: "PENDING" as PointStatus, toleranceAbsolute: null };
  }

  if (params.toleranceIsPercent && reference === 0) {
    return { deviation: "", status: "PENDING" as PointStatus, toleranceAbsolute: null };
  }

  const toleranceAbsolute = params.toleranceIsPercent
    ? (Math.abs(reference) * tolerance) / 100
    : Math.abs(tolerance);

  const deviation = reading - reference;
  const inTolerance = Math.abs(deviation) <= toleranceAbsolute;

  return {
    deviation: formatNumber(deviation),
    status: (inTolerance ? "PASS" : "FAIL") as PointStatus,
    toleranceAbsolute,
  };
}

function StatusCell({ status }: { status: PointStatus }) {
  const { t } = useLanguage();
  const Icon = status === "PASS" ? Check : status === "FAIL" ? X : Clock3;
  return (
    <div
      className={cn(
        "flex h-8 items-center justify-center gap-1.5 text-xs font-semibold",
        status === "PASS" && "bg-success-muted text-success",
        status === "FAIL" && "bg-destructive/5 text-destructive",
        status === "PENDING" && "bg-muted text-muted-foreground"
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {status === "PENDING"
        ? t("measurement.pending")
        : status === "PASS"
          ? t("measurement.pass")
          : t("measurement.fail")}
    </div>
  );
}

function DisplayCell({ value, status }: { value: string; status?: PointStatus }) {
  return (
    <div
      className={cn(
        "tabular flex h-8 items-center justify-end px-3 text-right",
        value && status === "PASS" && "bg-success-muted font-medium text-success",
        value && status === "FAIL" && "bg-destructive/5 font-medium text-destructive",
        !value && "text-muted-foreground"
      )}
    >
      {value || "—"}
    </div>
  );
}

function InputCell({
  registration,
  placeholder,
  tone = "capture",
}: {
  registration: ReturnType<ReturnType<typeof useForm<UpsertMeasurementInput>>["register"]>;
  placeholder?: string;
  /** "capture" = amarillo (lo escribe el técnico); "nominal" = blanco (default). */
  tone?: "capture" | "nominal";
}) {
  return (
    <input
      inputMode="decimal"
      placeholder={placeholder}
      className={cn(
        "tabular h-8 w-full px-3 text-right font-medium text-foreground outline-none ring-inset transition-colors focus:bg-white focus:ring-2 focus:ring-primary",
        tone === "capture" &&
          "bg-muted/70 placeholder:font-normal placeholder:text-muted-foreground hover:bg-muted",
        tone === "nominal" && "bg-white placeholder:font-normal placeholder:text-muted-foreground"
      )}
      {...registration}
    />
  );
}

function LabelCell({ children }: { children: React.ReactNode }) {
  return <td className="w-[58%] px-3 py-0 text-muted-foreground">{children}</td>;
}

function SectionRow({ children }: { children: string }) {
  return (
    <tr>
      <td
        colSpan={2}
        className="eyebrow bg-muted px-3 py-1"
      >
        {children}
      </td>
    </tr>
  );
}

/**
 * Un pase de medición (As Found o As Left): actual reference + UUT reading,
 * acceptance limit, Pass/Fail y deviation. Estructura de la plantilla thermocouple.
 */
function PassBlock({
  title,
  readingLabel,
  deviationLabel,
  base,
  referenceField,
  readingField,
  quantity,
  unit,
  acceptanceLimit,
  eval: evaluated,
  register,
}: {
  title: string;
  readingLabel: string;
  deviationLabel: string;
  base: string;
  referenceField: string;
  readingField: string;
  quantity: string;
  unit: string;
  acceptanceLimit: string;
  eval: ReturnType<typeof evalPass>;
  register: ReturnType<typeof useForm<UpsertMeasurementInput>>["register"];
}) {
  const { t } = useLanguage();
  return (
    <>
      <SectionRow>{title}</SectionRow>
      <tr className="border-b border-sig-100">
        <LabelCell>{t("measurement.actualReference", { quantity })}</LabelCell>
        <td className="w-[42%] p-0">
          <InputCell
            registration={register(`${base}.${referenceField}` as never)}
            placeholder={unit}
          />
        </td>
      </tr>
      <tr className="border-b border-sig-100">
        <LabelCell>{readingLabel}</LabelCell>
        <td className="p-0">
          <InputCell
            registration={register(`${base}.${readingField}` as never)}
            placeholder={unit}
          />
        </td>
      </tr>
      <tr className="border-b border-sig-100">
        <LabelCell>{t("measurement.acceptanceLimit")}</LabelCell>
        <td className="p-0">
          <DisplayCell value={acceptanceLimit} />
        </td>
      </tr>
      <tr className="border-b border-sig-100">
        <td className="px-3 py-0 font-semibold text-sig-900">
          {t("measurement.passFail")}
        </td>
        <td className="p-0">
          <StatusCell status={evaluated.status} />
        </td>
      </tr>
      <tr className="border-b border-sig-100">
        <LabelCell>{deviationLabel}</LabelCell>
        <td className="p-0">
          <DisplayCell
            value={evaluated.deviation ? `${evaluated.deviation} ${unit}` : ""}
            status={evaluated.status}
          />
        </td>
      </tr>
    </>
  );
}

function PointTable({
  measurementIndex,
  pointIndex,
  kind,
  row,
  certificateType,
  values,
  register,
}: {
  measurementIndex: number;
  pointIndex: number;
  kind: PointKind;
  row: MeasurementRow;
  certificateType: CertificateType;
  values: PointValues | undefined;
  register: ReturnType<typeof useForm<UpsertMeasurementInput>>["register"];
}) {
  const { locale, t } = useLanguage();
  const base = `measurements.${measurementIndex}.points.${pointIndex}`;
  const unit = cleanUnit(row.toleranceUnit);
  const quantity = getMeasuredQuantity(certificateType, locale);

  const asFound = evalPass({
    reference: values?.asFoundReference,
    reading: values?.asFoundReading,
    toleranceValue: row.toleranceValue,
    toleranceIsPercent: row.toleranceIsPercent,
  });
  const asLeft = evalPass({
    reference: values?.asLeftReference,
    reading: values?.asLeftReading,
    toleranceValue: row.toleranceValue,
    toleranceIsPercent: row.toleranceIsPercent,
  });

  const requiredAdjustment = asFound.status === "FAIL";

  function acceptanceLimit(toleranceAbsolute: number | null) {
    if (row.toleranceIsPercent) {
      return toleranceAbsolute === null
        ? `± ${row.toleranceValue}% ${unit}`
        : `± ${formatNumber(toleranceAbsolute)} ${unit}`;
    }
    return `± ${row.toleranceValue} ${unit}`;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-input bg-white">
      <div className="flex items-center justify-between bg-primary px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-white">
          {getPointKindLabel(kind, locale)}
        </span>
        {requiredAdjustment && (
          <span className="inline-flex items-center gap-1 rounded-md border border-warning/25 bg-warning-muted px-2 py-0.5 text-[10px] font-semibold text-warning">
            <TriangleAlert className="h-3 w-3" aria-hidden="true" />
            {t("measurement.adjusted")}
          </span>
        )}
      </div>

      {/* Fuera de la tabla: un <input> no puede ser hijo directo de <tbody>. */}
      <input type="hidden" {...register(`${base}.kind` as never)} />

      <table className="w-full border-collapse text-xs text-muted-foreground">
        <tbody>
          {getConditionLabel(certificateType, locale) && (
            <tr className="border-b border-sig-100">
              <LabelCell>{getConditionLabel(certificateType, locale)}</LabelCell>
              <td className="p-0">
                <InputCell registration={register(`${base}.conditionValue` as never)} />
              </td>
            </tr>
          )}

          <tr className="border-b border-sig-100">
            <LabelCell>{t("measurement.targetReference", { quantity })}</LabelCell>
            <td className="p-0">
              <InputCell
                registration={register(`${base}.targetNominal` as never)}
                placeholder={unit}
                tone="nominal"
              />
            </td>
          </tr>

          <PassBlock
            title={t("measurement.asFound")}
            readingLabel={t("measurement.readingAsFound")}
            deviationLabel={t("measurement.deviationAsFound")}
            base={base}
            referenceField="asFoundReference"
            readingField="asFoundReading"
            quantity={quantity}
            unit={unit}
            acceptanceLimit={acceptanceLimit(asFound.toleranceAbsolute)}
            eval={asFound}
            register={register}
          />

          <PassBlock
            title={t("measurement.asLeft")}
            readingLabel={t("measurement.readingAsLeft")}
            deviationLabel={t("measurement.deviationAsLeft")}
            base={base}
            referenceField="asLeftReference"
            readingField="asLeftReading"
            quantity={quantity}
            unit={unit}
            acceptanceLimit={acceptanceLimit(asLeft.toleranceAbsolute)}
            eval={asLeft}
            register={register}
          />
        </tbody>
      </table>
    </div>
  );
}

export function StepCertificateForm({
  title,
  description,
  reportId,
  certificateId,
  certificateType,
  rows,
  initialValues,
  onDirtyChange,
  onSaved,
}: Props) {
  const config = getCertificateConfig(certificateType);
  const { locale, t } = useLanguage();
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<UpsertMeasurementInput>({
    resolver: zodResolver(getUpsertMeasurementSchema(locale)),
    defaultValues: initialValues,
  });
  const { fields } = useFieldArray({ control: form.control, name: "measurements" });
  const watchedMeasurements = useWatch({ control: form.control, name: "measurements" });
  const isDirty = form.formState.isDirty;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const savedSummary = useMemo(
    () => ({
      failed: rows.filter((row) => row.status === MeasurementStatus.FAIL).length,
      pending: rows.filter((row) => row.status === MeasurementStatus.PENDING).length,
      passed: rows.filter((row) => row.status === MeasurementStatus.PASS).length,
      adjusted: rows.filter((row) => row.requiredAdjustment).length,
    }),
    [rows]
  );

  function onSubmit(values: UpsertMeasurementInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await upsertMeasurement(values);
      if (result?.ok === false) {
        setServerError(result.message);
        return;
      }
      form.reset(values);
      if (result?.certificateStatus) {
        onSaved?.(result.certificateStatus);
      }
      router.refresh();
      if (result?.certificateStatus !== "PENDING") {
        document
          .getElementById("certificate-signature")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  }

  const gridClass =
    config.pointKinds.length > 1 ? "grid gap-4 xl:grid-cols-2" : "grid gap-4 xl:max-w-lg";
  const certificateIndex = implementedCertificateTypes.indexOf(certificateType);
  const previousCertificate =
    certificateIndex > 0 ? implementedCertificateTypes[certificateIndex - 1] : undefined;
  const previousHref = previousCertificate
    ? certificateHref(reportId, previousCertificate)
    : `/reports/${reportId}/wizard/standards`;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <input type="hidden" value={reportId} {...form.register("reportId")} />
      <input type="hidden" value={certificateId} {...form.register("certificateId")} />
      <input type="hidden" value={certificateType} {...form.register("certificateType")} />

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

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <MeasurementStatusBadge status="PASS" />
            <span className="text-muted-foreground">
              {t("measurement.savedPass", { count: savedSummary.passed })}
            </span>
            <MeasurementStatusBadge status="FAIL" />
            <span className="text-muted-foreground">
              {t("measurement.savedFail", { count: savedSummary.failed })}
            </span>
            <MeasurementStatusBadge status="PENDING" />
            <span className="text-muted-foreground">
              {t("measurement.savedPending", { count: savedSummary.pending })}
            </span>
            {savedSummary.adjusted > 0 && (
              <span className="status-badge border-warning/25 bg-warning-muted text-warning">
                <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                {t("measurement.adjustedCount", { count: savedSummary.adjusted })}
              </span>
            )}
          </div>

          <div className="space-y-6">
            {fields.map((field, measurementIndex) => {
              const row = rows[measurementIndex];
              if (!row) return null;

              return (
                <section
                  key={field.id}
                  className={cn(
                    "rounded-xl border bg-white p-5 transition-colors",
                    row.status === MeasurementStatus.FAIL &&
                      "border-destructive/30 bg-destructive/[0.02]"
                  )}
                >
                  <input
                    type="hidden"
                    {...form.register(`measurements.${measurementIndex}.deviceSelectionId`)}
                  />

                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      <span className="tabular rounded-md bg-primary px-2.5 py-1 text-xs font-bold text-white">
                        {row.tagNumber}
                      </span>
                      <div>
                        <div className="text-sm font-semibold text-foreground">
                          {row.description}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t("measurement.tolerance")}: {" "}
                          <span className="tabular">{row.tolerance}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {t("measurement.lastStatus")}
                      </span>
                      <MeasurementStatusBadge status={row.status} />
                    </div>
                  </div>

                  {row.statusReason && (
                    <p className="mb-3 text-xs text-muted-foreground">{row.statusReason}</p>
                  )}

                  <div className={gridClass}>
                    {config.pointKinds.map((kind, pointIndex) => (
                      <PointTable
                        key={kind}
                        measurementIndex={measurementIndex}
                        pointIndex={pointIndex}
                        kind={kind}
                        row={row}
                        certificateType={certificateType}
                        values={watchedMeasurements?.[measurementIndex]?.points?.[pointIndex]}
                        register={form.register}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          <section className="rounded-xl border bg-white p-5">
            <label
              htmlFor="certificate-notes"
              className="text-sm font-semibold text-foreground"
            >
              {t("certificate.observations")}
            </label>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("certificate.observationsDescription")}
            </p>
            <textarea
              id="certificate-notes"
              rows={4}
              placeholder={t("certificate.observationsPlaceholder")}
              className="mt-3 w-full rounded-lg border border-input bg-muted/70 px-3 py-2 text-sm outline-none ring-inset transition-colors placeholder:text-muted-foreground hover:bg-muted focus:bg-white focus:ring-2 focus:ring-primary"
              {...form.register("notes")}
            />
            {form.formState.errors.notes && (
              <p className="mt-2 text-xs text-destructive">
                {form.formState.errors.notes.message}
              </p>
            )}
          </section>

          <p className="text-xs text-muted-foreground">
            {t("measurement.help")}
          </p>
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

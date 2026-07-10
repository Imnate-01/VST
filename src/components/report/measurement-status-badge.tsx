"use client";

import { CertificateStatus, MeasurementStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/language-provider";

type Status = MeasurementStatus | CertificateStatus;

const statusClasses: Record<string, string> = {
  PENDING: "bg-muted text-muted-foreground",
  PASS: "bg-green-100 text-green-700",
  FAIL: "bg-red-100 text-red-700",
  NA: "bg-slate-100 text-slate-600",
  MIXED: "bg-amber-100 text-amber-700",
};

export function MeasurementStatusBadge({
  status,
  className,
}: {
  status: Status;
  className?: string;
}) {
  const { t } = useLanguage();
  const label = {
    PENDING: t("measurement.pending"),
    PASS: t("measurement.pass"),
    FAIL: t("measurement.fail"),
    NA: t("measurement.na"),
    MIXED: t("measurement.mixed"),
  }[status];

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-1 text-xs font-semibold",
        statusClasses[status],
        className
      )}
    >
      {label}
    </span>
  );
}

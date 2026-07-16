"use client";

import { CertificateStatus, MeasurementStatus } from "@prisma/client";
import { Check, CircleMinus, Clock3, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/language-provider";

type Status = MeasurementStatus | CertificateStatus;

const statusClasses: Record<string, string> = {
  PENDING: "border-border bg-muted text-muted-foreground",
  PASS: "border-success/25 bg-success-muted text-success",
  FAIL: "border-destructive/25 bg-destructive/5 text-destructive",
  NA: "border-border bg-muted text-muted-foreground",
  MIXED: "border-warning/25 bg-warning-muted text-warning",
};

const statusIcons = {
  PENDING: Clock3,
  PASS: Check,
  FAIL: X,
  NA: CircleMinus,
  MIXED: TriangleAlert,
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
  const Icon = statusIcons[status];

  return (
    <span
      className={cn(
        "status-badge",
        statusClasses[status],
        className
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}

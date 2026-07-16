import { Check, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

export function ReportStatusBadge({
  status,
  label,
  className,
}: {
  status: "DRAFT" | "SUBMITTED";
  label: string;
  className?: string;
}) {
  const submitted = status === "SUBMITTED";
  const Icon = submitted ? Check : Pencil;

  return (
    <span
      className={cn(
        "status-badge",
        submitted
          ? "border-primary/20 bg-primary/5 text-primary"
          : "border-border bg-muted text-foreground",
        className
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}

"use client";

import { AlertTriangle, Check, Loader2, RefreshCw } from "lucide-react";
import { useReportSyncState } from "@/lib/offline/repository";
import { useNetworkStatus } from "@/components/offline/network-status-provider";
import { processOutbox } from "@/lib/offline/sync";
import { useLanguage } from "@/components/language-provider";
import { cn } from "@/lib/utils";

/**
 * Badge de estado de sync de un reporte descargado. Solo aparece si el reporte
 * está en el store local. Permite reintentar manualmente si hay errores.
 */
export function SyncStateBadge({ reportId }: { reportId: string }) {
  const { t } = useLanguage();
  const { online } = useNetworkStatus();
  const { downloaded, pending, errored } = useReportSyncState(reportId);

  if (!downloaded) return null;

  if (errored > 0) {
    return (
      <button
        type="button"
        onClick={() => void processOutbox()}
        disabled={!online}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1 text-xs font-medium text-destructive",
          online && "hover:bg-destructive/10"
        )}
        title={t("offline.syncRetry")}
      >
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
        {t("offline.syncError")}
        {online && <RefreshCw className="h-3 w-3" aria-hidden="true" />}
      </button>
    );
  }

  if (pending > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-warning-muted px-2 py-1 text-xs font-medium text-warning">
        <Loader2
          className={cn("h-3.5 w-3.5", online && "animate-spin")}
          aria-hidden="true"
        />
        {t("offline.pendingSync", { count: pending })}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-success-muted px-2 py-1 text-xs font-medium text-success">
      <Check className="h-3.5 w-3.5" aria-hidden="true" />
      {t("offline.synced")}
    </span>
  );
}

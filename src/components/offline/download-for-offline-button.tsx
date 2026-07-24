"use client";

import { useState } from "react";
import { Check, CloudDownload, Loader2, RotateCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  downloadReportForOffline,
  removeOfflineReport,
  useOfflineReport,
  useReportSyncState,
} from "@/lib/offline/repository";
import { useNetworkStatus } from "@/components/offline/network-status-provider";
import { useLanguage } from "@/components/language-provider";
import { formatDate } from "@/lib/utils";

/**
 * Control de "Disponible offline" para un reporte. Estados: descargar →
 * descargando → disponible (con acciones actualizar/quitar).
 */
export function DownloadForOfflineButton({
  reportId,
  compact = false,
}: {
  reportId: string;
  compact?: boolean;
}) {
  const { locale, t } = useLanguage();
  const { online } = useNetworkStatus();
  const stored = useOfflineReport(reportId);
  const { pending, errored } = useReportSyncState(reportId);
  const [busy, setBusy] = useState<"download" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isDownloaded = Boolean(stored);

  const download = async () => {
    setError(null);
    setBusy("download");
    try {
      await downloadReportForOffline(reportId);
    } catch {
      setError(t("offline.downloadError"));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    const hasLocalChanges = pending > 0 || errored > 0;
    const confirmed = window.confirm(
      hasLocalChanges
        ? t("offline.removePendingConfirm")
        : t("offline.removeConfirm")
    );
    if (!confirmed) return;

    setBusy("remove");
    try {
      await removeOfflineReport(reportId);
    } finally {
      setBusy(null);
    }
  };

  if (!isDownloaded) {
    return (
      <div className="flex flex-col items-start gap-1">
        <Button
          type="button"
          variant="outline"
          size={compact ? "sm" : "default"}
          onClick={download}
          disabled={busy !== null || !online}
          title={!online ? t("offline.needsConnection") : undefined}
        >
          {busy === "download" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <CloudDownload className="h-4 w-4" aria-hidden="true" />
          )}
          {busy === "download" ? t("offline.downloading") : t("offline.download")}
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-md bg-success-muted px-2 py-1 text-xs font-medium text-success">
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
        {t("offline.available")}
      </span>
      {stored && (
        <span className="text-xs text-muted-foreground">
          {t("offline.availableSince", {
            date: formatDate(new Date(stored.downloadedAt), locale),
          })}
        </span>
      )}
      <button
        type="button"
        onClick={download}
        disabled={busy !== null || !online}
        className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:underline disabled:text-muted-foreground disabled:no-underline"
      >
        {busy === "download" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {t("offline.update")}
      </button>
      <button
        type="button"
        onClick={remove}
        disabled={busy !== null}
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        {t("offline.remove")}
      </button>
      {error && <p className="w-full text-xs text-destructive">{error}</p>}
    </div>
  );
}

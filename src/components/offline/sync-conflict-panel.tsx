"use client";

import { useState } from "react";
import { AlertTriangle, Download, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  exportOfflineReport,
  removeOfflineReport,
  useErroredOps,
} from "@/lib/offline/repository";
import { processOutbox } from "@/lib/offline/sync";
import { useNetworkStatus } from "@/components/offline/network-status-provider";
import { useLanguage } from "@/components/language-provider";

/**
 * Panel de conflicto: aparece cuando alguna operación quedó en error (p.ej. el
 * reporte ya fue enviado o no pertenece al usuario). Nunca borra sin confirmar;
 * permite exportar la copia local antes de descartarla.
 */
export function SyncConflictPanel({ reportId }: { reportId: string }) {
  const { t } = useLanguage();
  const { online } = useNetworkStatus();
  const errored = useErroredOps(reportId);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  if (errored.length === 0) return null;

  const messages = Array.from(
    new Set(errored.map((op) => op.lastError).filter(Boolean))
  ) as string[];

  const exportLocal = async () => {
    const data = await exportOfflineReport(reportId);
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `vst-offline-${reportId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle
          className="mt-0.5 h-5 w-5 shrink-0 text-destructive"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-sm font-semibold text-destructive">
              {t("offline.conflictTitle")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("offline.conflictDescription")}
            </p>
          </div>

          {messages.length > 0 && (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {messages.map((message) => (
                <li key={message} className="rounded bg-white/60 px-2 py-1">
                  {message}
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void processOutbox()}
              disabled={!online}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              {t("offline.syncRetry")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void exportLocal()}
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              {t("offline.conflictExport")}
            </Button>
            {confirmDiscard ? (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => void removeOfflineReport(reportId)}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                {t("offline.conflictConfirmDiscard")}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setConfirmDiscard(true)}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                {t("offline.conflictDiscard")}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { submitReport } from "@/server/actions/reports-submit";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useNetworkStatus } from "@/components/offline/network-status-provider";
import { removeOfflineReport, useReportSyncState } from "@/lib/offline/repository";
import { useLanguage } from "@/components/language-provider";

export function SubmitReportBlock({
  reportId,
  blockedReason,
}: {
  reportId: string;
  /** null = se puede enviar. */
  blockedReason: string | null;
}) {
  const { t } = useLanguage();
  const { online } = useNetworkStatus();
  const { pending, errored } = useReportSyncState(reportId);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // El envío genera el PDF final en el servidor: requiere conexión y que no
  // queden cambios locales sin sincronizar.
  const effectiveBlockedReason =
    blockedReason ??
    (!online
      ? t("offline.submitNeedsOnline")
      : pending > 0 || errored > 0
        ? t("offline.submitPendingSync")
        : null);

  function onSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await submitReport({ reportId });
      if (result?.ok === false) {
        setError(result.message);
        return;
      }
      // Enviado: ya no es borrador editable, así que se limpia la copia offline.
      await removeOfflineReport(reportId).catch(() => {});
      // El wizard solo acepta borradores: una vez enviado, el reporte se ve
      // desde su detalle.
      router.push(`/reports/${reportId}`);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("review.submitTitle")}</CardTitle>
        <CardDescription>{t("review.submitDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <Button
          onClick={onSubmit}
          disabled={isPending || effectiveBlockedReason !== null}
        >
          {isPending ? t("review.submitting") : t("review.submit")}
        </Button>
        {effectiveBlockedReason && (
          <p className="text-xs text-warning">{effectiveBlockedReason}</p>
        )}
      </CardContent>
    </Card>
  );
}

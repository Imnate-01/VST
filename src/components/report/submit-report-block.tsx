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
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await submitReport({ reportId });
      if (result?.ok === false) {
        setError(result.message);
        return;
      }
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

        <Button onClick={onSubmit} disabled={isPending || blockedReason !== null}>
          {isPending ? t("review.submitting") : t("review.submit")}
        </Button>
        {blockedReason && <p className="text-xs text-warning">{blockedReason}</p>}
      </CardContent>
    </Card>
  );
}

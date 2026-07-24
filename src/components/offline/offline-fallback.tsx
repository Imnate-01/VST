"use client";

import { CloudOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/language-provider";

export function OfflineFallback() {
  const { t } = useLanguage();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted/35 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-warning-muted text-warning">
        <CloudOff className="h-8 w-8" aria-hidden="true" />
      </div>
      <div className="max-w-sm space-y-2">
        <h1 className="text-xl font-semibold text-foreground">
          {t("offline.pageTitle")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("offline.pageDescription")}
        </p>
      </div>
      <Button variant="outline" onClick={() => window.location.reload()}>
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        {t("offline.retry")}
      </Button>
    </main>
  );
}

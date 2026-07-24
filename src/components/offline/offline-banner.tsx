"use client";

import { CloudOff } from "lucide-react";
import { useNetworkStatus } from "@/components/offline/network-status-provider";
import { useLanguage } from "@/components/language-provider";

/**
 * Barra ámbar visible solo sin conexión. Anunciada por aria-live para lectores
 * de pantalla. El resto del estado de sync vive en badges por reporte.
 */
export function OfflineBanner() {
  const { online } = useNetworkStatus();
  const { t } = useLanguage();

  return (
    <div aria-live="polite" className="sticky top-0 z-40">
      {!online && (
        <div className="flex items-center justify-center gap-2 bg-warning px-4 py-1.5 text-center text-xs font-medium text-warning-foreground">
          <CloudOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{t("offline.banner")}</span>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { useNetworkStatus } from "@/components/offline/network-status-provider";
import { processOutbox } from "@/lib/offline/sync";

/**
 * Dispara la sincronización del outbox cuando vuelve la conexión, al enfocar la
 * pestaña y en un intervalo de respaldo. No renderiza nada.
 */
export function OfflineSync() {
  const { online } = useNetworkStatus();

  useEffect(() => {
    if (!online) return;

    void processOutbox();

    const onVisible = () => {
      if (document.visibilityState === "visible") void processOutbox();
    };
    document.addEventListener("visibilitychange", onVisible);

    const interval = window.setInterval(() => {
      if (navigator.onLine) void processOutbox();
    }, 60_000);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(interval);
    };
  }, [online]);

  return null;
}

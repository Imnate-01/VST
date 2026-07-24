"use client";

import { useEffect, useState } from "react";
import { HardDrive } from "lucide-react";
import {
  getStorageEstimate,
  requestPersistentStorage,
} from "@/lib/offline/storage";
import { useLanguage } from "@/components/language-provider";

/**
 * Solicita almacenamiento persistente una vez y avisa si la cuota está casi
 * llena (riesgo de perder capturas offline sin sincronizar).
 */
export function OfflineStorage() {
  const { t } = useLanguage();
  const [low, setLow] = useState(false);

  useEffect(() => {
    void requestPersistentStorage();
    void getStorageEstimate().then((estimate) => {
      if (estimate && estimate.ratio > 0.9) setLow(true);
    });
  }, []);

  if (!low) return null;

  return (
    <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg border border-warning/25 bg-warning-muted px-3 py-2 text-xs text-warning">
      <HardDrive className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{t("offline.storageLow")}</span>
    </div>
  );
}

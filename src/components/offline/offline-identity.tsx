"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { prepareOfflineSession } from "@/lib/offline/session";
import { useLanguage } from "@/components/language-provider";

/**
 * Persiste la identidad de la sesión en Dexie para autoría del outbox y para
 * mostrar el firmante en firmas capturadas offline. No renderiza nada.
 */
export function OfflineIdentity() {
  const { data } = useSession();
  const { locale } = useLanguage();

  useEffect(() => {
    const user = data?.user;
    if (!user?.id) return;
    void prepareOfflineSession({
      userId: user.id,
      role: user.role ?? "ENGINEER",
      name: user.name ?? "",
      title: user.title ?? "",
      locale,
    });
  }, [data, locale]);

  return null;
}

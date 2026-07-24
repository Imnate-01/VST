"use client";

import { SessionProvider } from "next-auth/react";
import { LanguageProvider } from "@/components/language-provider";
import { NetworkStatusProvider } from "@/components/offline/network-status-provider";
import type { Locale } from "@/lib/i18n";

export function Providers({ children, locale }: { children: React.ReactNode; locale: Locale }) {
  return (
    <SessionProvider>
      <LanguageProvider initialLocale={locale}>
        <NetworkStatusProvider>{children}</NetworkStatusProvider>
      </LanguageProvider>
    </SessionProvider>
  );
}

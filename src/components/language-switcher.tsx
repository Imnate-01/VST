"use client";

import { Languages } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale, t } = useLanguage();

  return (
    <label className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
      <Languages className="h-4 w-4" aria-hidden="true" />
      <span className="sr-only">{t("language.label")}</span>
      <select
        value={locale}
        onChange={(event) => setLocale(event.target.value as "es" | "en")}
        aria-label={t("language.label")}
        className="h-9 rounded-lg border border-input bg-background px-2 text-xs font-semibold text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
      >
        <option value="es">{t("language.es")}</option>
        <option value="en">{t("language.en")}</option>
      </select>
    </label>
  );
}

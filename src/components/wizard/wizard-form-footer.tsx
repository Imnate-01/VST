"use client";

import Link from "next/link";
import { Check, ChevronLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/language-provider";

export function WizardFormFooter({
  previousHref,
  pending,
  disabled = false,
  submitLabel,
  hint,
}: {
  previousHref: string;
  pending: boolean;
  disabled?: boolean;
  submitLabel: string;
  hint?: string;
}) {
  const { t } = useLanguage();

  return (
    <footer className="sticky bottom-0 z-20 mt-12 flex flex-col gap-4 border-t bg-white/95 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
      <Button asChild variant="outline">
        <Link href={previousHref}>
          <ChevronLeft className="h-4 w-4" />
          {t("wizard.previous")}
        </Link>
      </Button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : (
            <Check className="h-4 w-4 text-success" />
          )}
          {pending ? t("common.saving") : (hint ?? t("wizard.saveHint"))}
        </span>
        <Button type="submit" disabled={pending || disabled}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </footer>
  );
}

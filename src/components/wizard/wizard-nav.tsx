"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckCircle2, Circle, Lock } from "lucide-react";
import {
  CERTIFICATE_CONFIG,
  certificateTypesInPdfOrder,
} from "@/lib/certificates";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/language-provider";
import { getCertificateLabel } from "@/lib/certificates";

type Step = {
  href: string;
  activeMatch: string;
  label: string;
  enabled: boolean;
};

export function WizardNav({ reportId }: { reportId: string }) {
  const pathname = usePathname();
  const { locale, t } = useLanguage();
  const certificateSteps: Step[] = certificateTypesInPdfOrder.map((type) => {
    const config = CERTIFICATE_CONFIG[type];
    return {
      href: `cert/${config.route}`,
      activeMatch: `/wizard/cert/${config.route}`,
      label: getCertificateLabel(type, locale),
      enabled: config.implemented,
    };
  });
  const steps: Step[] = [
    { href: "info", activeMatch: "/wizard/info", label: t("wizard.info"), enabled: true },
    { href: "devices", activeMatch: "/wizard/devices", label: t("wizard.devices"), enabled: true },
    { href: "standards", activeMatch: "/wizard/standards", label: t("wizard.standards"), enabled: true },
    ...certificateSteps,
    { href: "review", activeMatch: "/wizard/review", label: t("wizard.review"), enabled: false },
  ];

  return (
    <nav className="rounded-xl border bg-card p-3">
      <ol className="grid gap-2 sm:grid-cols-3 xl:grid-cols-4">
        {steps.map((step) => {
          const active = pathname.includes(step.activeMatch);
          const content = (
            <span
              className={cn(
                "flex min-h-12 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active && "bg-primary text-primary-foreground",
                !active && step.enabled && "hover:bg-accent",
                !step.enabled && "cursor-not-allowed text-muted-foreground opacity-70"
              )}
            >
              {step.enabled ? (
                active ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0" />
                )
              ) : (
                <Lock className="h-4 w-4 shrink-0" />
              )}
              <span className="min-w-0">
                <span className="block truncate">{step.label}</span>
                {!step.enabled && (
                  <span className="block text-[10px] font-normal">
                    {t("wizard.nextSprint")}
                  </span>
                )}
              </span>
            </span>
          );

          return (
            <li key={step.href}>
              {step.enabled ? (
                <Link href={`/reports/${reportId}/wizard/${step.href}`}>{content}</Link>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

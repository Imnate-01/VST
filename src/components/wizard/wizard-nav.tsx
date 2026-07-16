"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, Lock } from "lucide-react";
import { implementedCertificateTypes, getCertificateConfig, getCertificateLabel } from "@/lib/certificates";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/language-provider";

type Step = {
  href: string;
  activeMatch: string;
  label: string;
  enabled: boolean;
};

export function WizardNav({ reportId }: { reportId: string }) {
  const pathname = usePathname();
  const { locale, t } = useLanguage();
  const steps: Step[] = [
    { href: "info", activeMatch: "/wizard/info", label: t("wizard.info"), enabled: true },
    { href: "devices", activeMatch: "/wizard/devices", label: t("wizard.devices"), enabled: true },
    { href: "standards", activeMatch: "/wizard/standards", label: t("wizard.standards"), enabled: true },
    ...implementedCertificateTypes.map((type) => {
      const config = getCertificateConfig(type);
      return {
        href: `cert/${config.route}`,
        activeMatch: `/wizard/cert/${config.route}`,
        label: getCertificateLabel(type, locale),
        enabled: true,
      };
    }),
    { href: "review", activeMatch: "/wizard/review", label: t("wizard.review"), enabled: false },
  ];
  const activeIndex = Math.max(0, steps.findIndex((step) => pathname.includes(step.activeMatch)));

  return (
    <nav className="overflow-x-auto border-y bg-white" aria-label={t("wizard.title")}>
      <ol className="flex min-w-max items-center px-1 py-5">
        {steps.map((step, index) => {
          const active = index === activeIndex;
          const complete = index < activeIndex;
          const content = (
            <span className="flex items-center gap-3">
              <span
                className={cn(
                  "technical-id flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
                  active && "border-2 border-primary bg-white text-primary",
                  complete && "border-primary bg-primary text-white",
                  !active && !complete && "border-border bg-muted text-muted-foreground"
                )}
              >
                {complete ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : !step.enabled ? (
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  index + 1
                )}
              </span>
              <span
                className={cn(
                  "max-w-48 truncate text-sm font-semibold",
                  active || complete ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </span>
          );

          return (
            <li key={step.href} className="flex items-center">
              {step.enabled ? (
                <Link
                  href={`/reports/${reportId}/wizard/${step.href}`}
                  className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  aria-current={active ? "step" : undefined}
                >
                  {content}
                </Link>
              ) : (
                content
              )}
              {index < steps.length - 1 && (
                <span className={cn("mx-3 h-0.5 w-7 rounded-full", complete ? "bg-primary" : "bg-border")} />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

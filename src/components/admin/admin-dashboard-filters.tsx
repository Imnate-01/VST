"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Building2, CalendarDays } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { cn } from "@/lib/utils";

type ClientOption = { id: string; label: string };

export function AdminDashboardFilters({ clients }: { clients: ClientOption[] }) {
  const { t } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function updateFilter(name: "days" | "client", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") params.delete(name);
    else params.set(name, value);
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row", pending && "opacity-60")}>
      <label className="relative">
        <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <span className="sr-only">{t("admin.periodSummary")}</span>
        <select
          value={searchParams.get("days") ?? "30"}
          onChange={(event) => updateFilter("days", event.target.value)}
          className="h-12 min-w-48 rounded-xl border border-input bg-white pl-10 pr-9 text-sm font-semibold"
          disabled={pending}
        >
          <option value="30">{t("admin.last30Days")}</option>
          <option value="90">{t("admin.last90Days")}</option>
          <option value="365">{t("admin.lastYear")}</option>
        </select>
      </label>

      <label className="relative">
        <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <span className="sr-only">{t("admin.client")}</span>
        <select
          value={searchParams.get("client") ?? "all"}
          onChange={(event) => updateFilter("client", event.target.value)}
          className="h-12 min-w-44 rounded-xl border border-input bg-white pl-10 pr-9 text-sm font-semibold"
          disabled={pending}
        >
          <option value="all">{t("admin.allClients")}</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

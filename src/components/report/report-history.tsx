"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, FileText, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReportStatusBadge } from "@/components/report/report-status-badge";
import { useLanguage } from "@/components/language-provider";

export type ReportHistoryItem = {
  id: string;
  reportNumber: string;
  status: "DRAFT" | "SUBMITTED";
  clientName: string;
  fillerModel: string;
  serialNumber: string;
  serviceDate: string;
  preparedBy: string;
  progressStep: number;
  progressKey: "info" | "devices" | "standards" | "calibration";
  passedCertificates: number;
  totalCertificates: number;
  failCount: number;
};

type StatusFilter = "ALL" | "DRAFT" | "SUBMITTED";
type DateFilter = "ALL" | "30" | "90" | "365";

export function ReportHistory({
  reports,
  showEngineer,
}: {
  reports: ReportHistoryItem[];
  showEngineer: boolean;
}) {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [client, setClient] = useState("ALL");
  const [dateRange, setDateRange] = useState<DateFilter>("ALL");
  const clients = useMemo(
    () => [...new Set(reports.map((report) => report.clientName))].sort(),
    [reports]
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const now = Date.now();
    return reports.filter((report) => {
      const matchesSearch =
        !needle ||
        report.reportNumber.toLowerCase().includes(needle) ||
        report.clientName.toLowerCase().includes(needle) ||
        report.serialNumber.toLowerCase().includes(needle);
      const matchesStatus = status === "ALL" || report.status === status;
      const matchesClient = client === "ALL" || report.clientName === client;
      const age = now - new Date(report.serviceDate).getTime();
      const matchesDate =
        dateRange === "ALL" || age <= Number(dateRange) * 24 * 60 * 60 * 1000;
      return matchesSearch && matchesStatus && matchesClient && matchesDate;
    });
  }, [client, dateRange, reports, search, status]);

  const hasFilters = search.length > 0 || status !== "ALL" || client !== "ALL" || dateRange !== "ALL";

  function clearFilters() {
    setSearch("");
    setStatus("ALL");
    setClient("ALL");
    setDateRange("ALL");
  }

  return (
    <div className="space-y-7">
      <section className="flex flex-col gap-3 border-b pb-7 lg:flex-row">
        <label className="relative min-w-0 flex-1 lg:max-w-md">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <span className="sr-only">{t("reports.searchPlaceholder")}</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("reports.searchPlaceholder")}
            className="h-12 w-full rounded-xl border border-input bg-white pl-12 pr-4 text-sm outline-none transition-shadow focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>

        <FilterSelect
          label={t("reports.filterStatus")}
          value={status}
          onChange={(value) => setStatus(value as StatusFilter)}
          options={[
            ["ALL", t("reports.filterAll")],
            ["DRAFT", t("reports.status.draft")],
            ["SUBMITTED", t("reports.status.submitted")],
          ]}
        />
        <FilterSelect
          label={t("reports.filterClient")}
          value={client}
          onChange={setClient}
          options={[["ALL", t("reports.filterAll")], ...clients.map((name) => [name, name] as [string, string])]}
        />
        <FilterSelect
          label={t("reports.filterDate")}
          value={dateRange}
          onChange={(value) => setDateRange(value as DateFilter)}
          options={[
            ["ALL", t("reports.filterAll")],
            ["30", t("reports.last30Days")],
            ["90", t("reports.last90Days")],
            ["365", t("reports.lastYear")],
          ]}
        />

        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" /> {t("reports.clearFilters")}
          </button>
        )}
      </section>

      {filtered.length === 0 ? (
        <EmptyState hasReports={reports.length > 0} onClear={clearFilters} />
      ) : (
        <div className="space-y-4">
          {filtered.map((report) => (
            <ReportCard key={report.id} report={report} showEngineer={showEngineer} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 min-w-40 rounded-xl border border-input bg-white px-4 pr-9 text-sm font-semibold"
        aria-label={label}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {label}: {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function ReportCard({ report, showEngineer }: { report: ReportHistoryItem; showEngineer: boolean }) {
  const { t } = useLanguage();
  const draft = report.status === "DRAFT";
  const reportHref = draft
    ? `/reports/${report.id}/wizard/info`
    : `/reports/${report.id}`;
  const progressLabel = draft
    ? `${t("reports.step", { step: report.progressStep })} · ${
        report.progressKey === "info"
          ? t("reports.progressInfo")
          : report.progressKey === "devices"
            ? t("reports.progressDevices")
            : report.progressKey === "standards"
              ? t("reports.progressStandards")
              : t("reports.progressCalibration")
      }`
    : t("reports.certificateProgress", {
        passed: report.passedCertificates,
        total: report.totalCertificates,
      });

  return (
    <article className="flex flex-col gap-5 rounded-xl border bg-white p-5 transition-colors hover:border-input sm:p-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={reportHref}
            className="technical-id max-w-full truncate text-lg font-semibold hover:text-primary sm:text-xl"
          >
            {report.reportNumber}
          </Link>
          <ReportStatusBadge
            status={report.status}
            label={draft ? t("reports.status.draft") : t("reports.status.submitted")}
          />
          {report.failCount > 0 && (
            <span className="status-badge border-destructive/25 bg-destructive/5 text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              {t("reports.failCount", { count: report.failCount })}
            </span>
          )}
        </div>

        <div className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-[1fr_1fr_auto]">
          <span>{report.clientName}</span>
          <span className="technical-id text-muted-foreground">
            {report.fillerModel} · SN {report.serialNumber}
          </span>
          <time className="technical-id whitespace-nowrap text-muted-foreground">
            {report.serviceDate.slice(0, 10)}
          </time>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {progressLabel}
          {showEngineer && ` · ${report.preparedBy}`}
        </p>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-2 lg:w-40 lg:grid-cols-1">
        <Button asChild variant={draft ? "default" : "outline"}>
          <Link href={reportHref}>
            {draft ? t("common.continue") : t("reports.openReport")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/reports/${report.id}/pdf`} target="_blank" prefetch={false}>
            <FileText className="h-4 w-4" />
            {t("reports.viewPdf")}
          </Link>
        </Button>
      </div>
    </article>
  );
}

function EmptyState({ hasReports, onClear }: { hasReports: boolean; onClear: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="rounded-xl border border-dashed border-input bg-white px-6 py-16 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Search className="h-7 w-7" />
      </div>
      <h2 className="mt-5 text-lg font-semibold">
        {hasReports ? t("reports.noMatches") : t("reports.empty")}
      </h2>
      <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
        {hasReports ? t("reports.noMatchesHelp") : t("dashboard.emptyCta")}
      </p>
      {hasReports ? (
        <Button type="button" variant="outline" className="mt-6" onClick={onClear}>
          {t("reports.clearFilters")}
        </Button>
      ) : (
        <Button asChild className="mt-6">
          <Link href="/reports/new">{t("reports.createFirst")}</Link>
        </Button>
      )}
    </div>
  );
}

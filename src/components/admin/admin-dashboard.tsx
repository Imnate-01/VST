import Link from "next/link";
import { Check, FileText, TriangleAlert, X } from "lucide-react";
import { CertificateStatus } from "@prisma/client";
import { prisma } from "@/server/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminDashboardFilters } from "@/components/admin/admin-dashboard-filters";
import { getTranslations } from "@/lib/i18n-server";
import { cn } from "@/lib/utils";

const DAY_MS = 24 * 60 * 60 * 1000;

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function reportResult(statuses: CertificateStatus[]) {
  if (statuses.some((status) => status === "FAIL" || status === "MIXED")) return "FAIL";
  if (statuses.length > 0 && statuses.every((status) => status === "PASS")) return "PASS";
  return "PENDING";
}

export async function AdminDashboard({
  days,
  clientId,
}: {
  days: number;
  clientId?: string;
}) {
  const { locale, t } = await getTranslations();
  const now = new Date();
  const rangeStart = new Date(now.getTime() - days * DAY_MS);
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS);
  const chartStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const reportWhere = {
    serviceDate: { gte: rangeStart, lte: now },
    ...(clientId ? { fillerId: clientId } : {}),
  };
  const clientScope = clientId ? { fillerId: clientId } : {};

  const [
    reports,
    chartReports,
    activeEngineers,
    failedMeasurements,
    expiredStandards,
    oldDrafts,
    clients,
  ] = await Promise.all([
    prisma.report.findMany({
      where: reportWhere,
      orderBy: { serviceDate: "desc" },
      include: {
        filler: { include: { model: true } },
        preparedBy: { select: { name: true } },
        certificates: { select: { overallStatus: true } },
      },
    }),
    prisma.report.findMany({
      where: { serviceDate: { gte: chartStart, lte: now }, ...clientScope },
      select: { serviceDate: true, status: true },
    }),
    prisma.user.count({ where: { role: "ENGINEER", active: true } }),
    prisma.certificateMeasurement.findMany({
      where: {
        status: "FAIL",
        certificate: { report: reportWhere },
      },
      select: {
        certificate: { select: { reportId: true } },
        deviceSelection: {
          select: { deviceCatalog: { select: { deviceType: true } } },
        },
      },
    }),
    prisma.standardInstrument.count({
      where: { active: true, calibrationExpiresAt: { lt: now } },
    }),
    prisma.report.count({
      where: { status: "DRAFT", createdAt: { lt: sevenDaysAgo }, ...clientScope },
    }),
    prisma.filler.findMany({
      where: { active: true },
      orderBy: [{ clientName: "asc" }, { serialNumber: "asc" }],
      select: { id: true, clientName: true, serialNumber: true },
    }),
  ]);

  const results = reports.map((report) =>
    reportResult(report.certificates.map((certificate) => certificate.overallStatus))
  );
  const passed = results.filter((result) => result === "PASS").length;
  const failed = results.filter((result) => result === "FAIL").length;
  const completed = passed + failed;
  const passRate = completed > 0 ? Math.round((passed / completed) * 100) : 0;
  const awaitingReview = reports.filter((report) => report.status === "SUBMITTED").length;
  const olderAwaitingReview = reports.filter(
    (report) =>
      report.status === "SUBMITTED" &&
      Boolean(report.submittedAt && report.submittedAt < sevenDaysAgo)
  ).length;

  const monthFormatter = new Intl.DateTimeFormat(locale === "es" ? "es-MX" : "en-US", {
    month: "short",
    timeZone: "UTC",
  });
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + index, 1));
    const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
    const matches = chartReports.filter(
      (report) =>
        `${report.serviceDate.getUTCFullYear()}-${report.serviceDate.getUTCMonth()}` === key
    );
    return {
      label: monthFormatter.format(date).replace(".", ""),
      sent: matches.filter((report) => report.status === "SUBMITTED").length,
      draft: matches.filter((report) => report.status === "DRAFT").length,
    };
  });
  const maxMonth = Math.max(1, ...months.map((month) => month.sent + month.draft));

  const failureMap = new Map<string, number>();
  const failedReportIds = new Set<string>();
  for (const measurement of failedMeasurements) {
    const type = measurement.deviceSelection.deviceCatalog.deviceType.replaceAll("_", " ");
    failureMap.set(type, (failureMap.get(type) ?? 0) + 1);
    failedReportIds.add(measurement.certificate.reportId);
  }
  const failureTypes = [...failureMap.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const maxFailures = Math.max(1, ...failureTypes.map((item) => item.count));
  const latestReports = reports.slice(0, 5);
  const alertCount = expiredStandards + oldDrafts + failedReportIds.size;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-5 border-b pb-8 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-4xl font-bold leading-tight">{t("admin.operationsOverview")}</h1>
          <p className="mt-1 text-lg text-muted-foreground">{t("admin.activityQuality")}</p>
        </div>
        <AdminDashboardFilters
          clients={clients.map((client) => ({
            id: client.id,
            label: `${client.clientName} · ${client.serialNumber}`,
          }))}
        />
      </header>

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={t("admin.reportsGenerated")}
          value={String(reports.length)}
          detail={t("admin.periodSummary")}
        />
        <MetricCard
          label={t("admin.globalResult")}
          value={`${passRate}%`}
          detail={t("admin.passSummary", { passes: passed, fails: failed })}
          tone="success"
        />
        <MetricCard
          label={t("admin.activeEngineers")}
          value={String(activeEngineers)}
          detail={t("admin.activeAccounts")}
        />
        <MetricCard
          label={t("admin.awaitingReview")}
          value={String(awaitingReview)}
          detail={t("admin.olderThan7", { count: olderAwaitingReview })}
          tone={olderAwaitingReview > 0 ? "warning" : "neutral"}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
            <CardTitle className="text-xl">{t("admin.reportsPerMonth")}</CardTitle>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-primary" /> {t("admin.sent")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-border" /> {t("admin.draft")}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid h-72 grid-cols-6 items-end gap-4 pt-5">
              {months.map((month) => {
                const total = month.sent + month.draft;
                return (
                  <div key={month.label} className="flex h-full flex-col items-center justify-end gap-2">
                    <span className="technical-id text-xs font-semibold">{total}</span>
                    <div
                      className="flex w-full max-w-14 flex-col justify-end overflow-hidden rounded-t-md bg-muted"
                      style={{ height: `${Math.max(8, (total / maxMonth) * 88)}%` }}
                    >
                      <div
                        className="bg-border"
                        style={{ height: total ? `${(month.draft / total) * 100}%` : "0%" }}
                      />
                      <div
                        className="bg-primary"
                        style={{ height: total ? `${(month.sent / total) * 100}%` : "0%" }}
                      />
                    </div>
                    <span className="text-xs capitalize text-muted-foreground">{month.label}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{t("admin.failuresByDevice")}</CardTitle>
          </CardHeader>
          <CardContent>
            {failureTypes.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                {t("admin.noRecords")}
              </p>
            ) : (
              <div className="space-y-5">
                {failureTypes.map((item) => (
                  <div key={item.type}>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="capitalize">{item.type.toLowerCase()}</span>
                      <span className="technical-id font-semibold">{item.count}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-[#7D7975]"
                        style={{ width: `${(item.count / maxFailures) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
                <p className="border-t pt-4 text-xs leading-relaxed text-muted-foreground">
                  {t("admin.failureSummary", {
                    count: failedMeasurements.length,
                    reports: failedReportIds.size,
                  })}{" "}
                  {t("admin.failureNote")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1.45fr_0.95fr]">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-xl">{t("admin.latestReports")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {latestReports.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                {t("admin.noRecords")}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-modern min-w-[720px]">
                  <thead>
                    <tr>
                      <th>{t("reports.column.report")}</th>
                      <th>{t("admin.client")}</th>
                      <th>{t("admin.engineer")}</th>
                      <th>{t("admin.date")}</th>
                      <th>{t("admin.result")}</th>
                      <th>{t("admin.pdf")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestReports.map((report) => {
                      const result = reportResult(
                        report.certificates.map((certificate) => certificate.overallStatus)
                      );
                      return (
                        <tr key={report.id}>
                          <td>
                            <Link
                              href={`/reports/${report.id}`}
                              className="technical-id block max-w-48 truncate font-semibold hover:text-primary"
                            >
                              {report.reportNumber}
                            </Link>
                          </td>
                          <td>{report.filler.clientName}</td>
                          <td>{report.preparedBy.name}</td>
                          <td className="technical-id text-muted-foreground">
                            {isoDate(report.serviceDate)}
                          </td>
                          <td>
                            {result === "PASS" ? (
                              <span className="inline-flex items-center gap-1 text-sm font-semibold text-success">
                                <Check className="h-4 w-4" /> {t("admin.pass")}
                              </span>
                            ) : result === "FAIL" ? (
                              <span className="inline-flex items-center gap-1 text-sm font-semibold text-destructive">
                                <X className="h-4 w-4" /> {t("admin.fail")}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td>
                            <Link
                              href={`/reports/${report.id}/pdf`}
                              target="_blank"
                              className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                            >
                              <FileText className="h-4 w-4" /> {t("admin.pdf")}
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <section>
          <h2 className="mb-4 text-xl font-semibold">{t("admin.alerts")}</h2>
          {alertCount === 0 ? (
            <Card>
              <CardContent className="flex items-center gap-3 py-6 text-sm text-success">
                <Check className="h-5 w-5" /> {t("admin.noAlerts")}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {expiredStandards > 0 && (
                <AlertCard
                  tone="error"
                  title={t("admin.expiredStandards", { count: expiredStandards })}
                  description={t("admin.blockSigning")}
                  href="/admin/standards"
                  action={t("admin.openStandards")}
                />
              )}
              {oldDrafts > 0 && (
                <AlertCard
                  tone="warning"
                  title={t("admin.oldDrafts", { count: oldDrafts })}
                  description={t("admin.nudgeEngineers")}
                  href="/reports"
                  action={t("admin.viewDrafts")}
                />
              )}
              {failedReportIds.size > 0 && (
                <AlertCard
                  tone="info"
                  title={t("admin.failedReports", { count: failedReportIds.size })}
                  description={t("admin.requiresCorrective")}
                  href="/reports"
                  action={t("admin.reviewReports")}
                />
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "success" | "warning";
}) {
  return (
    <Card className="min-h-40">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="tabular text-4xl font-bold">{value}</div>
        <p
          className={cn(
            "mt-4 text-sm",
            tone === "success" && "text-success",
            tone === "warning" && "text-warning",
            tone === "neutral" && "text-muted-foreground"
          )}
        >
          {detail}
        </p>
      </CardContent>
    </Card>
  );
}

function AlertCard({
  title,
  description,
  action,
  href,
  tone,
}: {
  title: string;
  description: string;
  action: string;
  href: string;
  tone: "error" | "warning" | "info";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border-l-[3px] p-5",
        tone === "error" && "border border-destructive/25 border-l-destructive bg-destructive/5",
        tone === "warning" && "border border-warning/25 border-l-warning bg-warning-muted",
        tone === "info" && "border border-primary/25 border-l-primary bg-primary/5"
      )}
    >
      <div className="flex items-start gap-3">
        <TriangleAlert
          className={cn(
            "mt-0.5 h-5 w-5 shrink-0",
            tone === "error" && "text-destructive",
            tone === "warning" && "text-warning",
            tone === "info" && "text-primary"
          )}
        />
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
          <Link
            href={href}
            className={cn(
              "mt-4 inline-flex text-sm font-semibold hover:underline",
              tone === "error" && "text-destructive",
              tone === "warning" && "text-warning",
              tone === "info" && "text-primary"
            )}
          >
            {action} →
          </Link>
        </div>
      </div>
    </div>
  );
}

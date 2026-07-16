import Link from "next/link";
import { Check, Clock3, FilePlus, FileText, TriangleAlert } from "lucide-react";
import { requireAuth } from "@/server/auth";
import { prisma } from "@/server/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReportStatusBadge } from "@/components/report/report-status-badge";
import { getTranslations } from "@/lib/i18n-server";
import { cn } from "@/lib/utils";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

const DAY_MS = 24 * 60 * 60 * 1000;

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function daysFrom(date: Date, now: Date) {
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / DAY_MS));
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ days?: string; client?: string }>;
}) {
  const session = await requireAuth();
  const { t } = await getTranslations();
  if (session.user.role === "ADMIN") {
    const filters = (await searchParams) ?? {};
    const days = [30, 90, 365].includes(Number(filters.days)) ? Number(filters.days) : 30;
    return <AdminDashboard days={days} clientId={filters.client} />;
  }

  const now = new Date();
  const thisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const previousMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const owner = { preparedById: session.user.id };

  const [
    totalDraft,
    totalSubmitted,
    reportsThisMonth,
    submittedThisMonth,
    submittedLastMonth,
    upcomingServices,
    nextService,
    oldestDraft,
    recent,
    standards,
  ] = await Promise.all([
    prisma.report.count({ where: { ...owner, status: "DRAFT" } }),
    prisma.report.count({ where: { ...owner, status: "SUBMITTED" } }),
    prisma.report.count({
      where: { ...owner, serviceDate: { gte: thisMonth, lt: nextMonth } },
    }),
    prisma.report.count({
      where: {
        ...owner,
        status: "SUBMITTED",
        submittedAt: { gte: thisMonth, lt: nextMonth },
      },
    }),
    prisma.report.count({
      where: {
        ...owner,
        status: "SUBMITTED",
        submittedAt: { gte: previousMonth, lt: thisMonth },
      },
    }),
    prisma.report.count({ where: { ...owner, serviceDate: { gte: now } } }),
    prisma.report.findFirst({
      where: { ...owner, serviceDate: { gte: now } },
      orderBy: { serviceDate: "asc" },
      select: { serviceDate: true },
    }),
    prisma.report.findFirst({
      where: { ...owner, status: "DRAFT" },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    prisma.report.findMany({
      where: owner,
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: { filler: { include: { model: true } } },
    }),
    prisma.standardInstrument.findMany({
      where: { active: true },
      orderBy: { calibrationExpiresAt: "asc" },
      take: 3,
    }),
  ]);

  const submittedDelta = submittedThisMonth - submittedLastMonth;
  const draftAge = oldestDraft ? daysFrom(oldestDraft.createdAt, now) : 0;

  return (
    <div className="space-y-9">
      <header className="flex flex-col gap-5 border-b pb-8 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-4xl font-bold leading-tight">
            {t("dashboard.welcome", { name: session.user.name?.split(" ")[0] ?? "" })}
          </h1>
          <p className="mt-1 text-lg text-muted-foreground">
            {session.user.title} · {t("dashboard.inProgress", { count: totalDraft })}
          </p>
        </div>
        <Button asChild size="lg" className="shrink-0 sm:mt-1">
          <Link href="/reports/new">
            <FilePlus className="h-5 w-5" />
            {t("dashboard.newReport")}
          </Link>
        </Button>
      </header>

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4" aria-label="KPIs">
        <Card className="min-h-40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-muted-foreground">
              {t("dashboard.drafts")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="tabular text-4xl font-bold">{totalDraft}</div>
            <p className="mt-4 text-sm font-medium text-warning">
              {t("dashboard.oldestDraft", { days: draftAge })}
            </p>
          </CardContent>
        </Card>

        <Card className="min-h-40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-muted-foreground">
              {t("dashboard.submitted")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="tabular text-4xl font-bold">{totalSubmitted}</div>
            <p
              className={cn(
                "mt-4 text-sm font-medium",
                submittedDelta > 0 ? "text-success" : "text-muted-foreground"
              )}
            >
              {t("dashboard.vsLastMonth", {
                delta: submittedDelta > 0 ? `+${submittedDelta}` : submittedDelta,
              })}
            </p>
          </CardContent>
        </Card>

        <Card className="min-h-40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-muted-foreground">
              {t("dashboard.totalThisMonth")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="tabular text-4xl font-bold">{reportsThisMonth}</div>
            <p className="mt-4 text-sm text-muted-foreground">{t("dashboard.monthlyActivity")}</p>
          </CardContent>
        </Card>

        <Card className="min-h-40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-muted-foreground">
              {t("dashboard.upcomingServices")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="tabular text-4xl font-bold">{upcomingServices}</div>
            <p className="mt-4 text-sm text-muted-foreground">
              {nextService
                ? t("dashboard.nextService", { date: isoDate(nextService.serviceDate) })
                : t("dashboard.noUpcoming")}
            </p>
          </CardContent>
        </Card>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold">{t("dashboard.recent")}</h2>
          <Link href="/reports" className="text-sm font-semibold text-primary hover:underline">
            {t("dashboard.viewAll")}
          </Link>
        </div>

        {recent.length === 0 ? (
          <Card>
            <CardContent className="py-14 text-center text-muted-foreground">
              <FileText className="mx-auto mb-3 h-12 w-12 opacity-30" />
              <p>{t("dashboard.empty")}</p>
              <p className="mt-1 text-sm">{t("dashboard.emptyCta")}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="table-shell">
            <table className="table-modern min-w-[880px]">
              <thead>
                <tr>
                  <th>{t("reports.column.report")}</th>
                  <th>{t("dashboard.client")}</th>
                  <th>{t("dashboard.filler")}</th>
                  <th>{t("dashboard.service")}</th>
                  <th>{t("dashboard.status")}</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((report) => (
                  <tr key={report.id}>
                    <td>
                      <Link
                        href={
                          report.status === "DRAFT"
                            ? `/reports/${report.id}/wizard/info`
                            : `/reports/${report.id}`
                        }
                        className="technical-id font-semibold hover:text-primary"
                      >
                        {report.reportNumber}
                      </Link>
                    </td>
                    <td>{report.filler.clientName}</td>
                    <td className="technical-id text-muted-foreground">
                      {report.filler.model.name} · SN {report.filler.serialNumber}
                    </td>
                    <td className="technical-id whitespace-nowrap text-muted-foreground">
                      {isoDate(report.serviceDate)}
                    </td>
                    <td>
                      <ReportStatusBadge
                        status={report.status}
                        label={
                          report.status === "SUBMITTED"
                            ? t("reports.status.submitted")
                            : t("reports.status.draft")
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-2xl font-semibold">{t("dashboard.standardValidity")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("dashboard.standardValidityDescription")}
        </p>

        {standards.length > 0 && (
          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            {standards.map((standard) => {
              const daysRemaining = Math.ceil(
                (standard.calibrationExpiresAt.getTime() - now.getTime()) / DAY_MS
              );
              const state = daysRemaining < 0 ? "expired" : daysRemaining <= 30 ? "soon" : "valid";
              const StateIcon = state === "valid" ? Check : state === "soon" ? Clock3 : TriangleAlert;

              return (
                <Card key={standard.id}>
                  <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-4">
                    <CardTitle className="max-w-[13rem] text-lg">{standard.description}</CardTitle>
                    <span
                      className={cn(
                        "status-badge shrink-0",
                        state === "valid" && "border-success/25 bg-success-muted text-success",
                        state === "soon" && "border-warning/25 bg-warning-muted text-warning",
                        state === "expired" && "border-destructive/25 bg-destructive/5 text-destructive"
                      )}
                    >
                      <StateIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      {state === "valid"
                        ? t("dashboard.valid")
                        : state === "soon"
                          ? t("dashboard.expiringSoon")
                          : t("dashboard.expired")}
                    </span>
                  </CardHeader>
                  <CardContent>
                    <dl className="grid grid-cols-[5rem_1fr] gap-y-1 text-sm">
                      <dt className="text-muted-foreground">S/N</dt>
                      <dd className="technical-id">{standard.serialNumber}</dd>
                      <dt className="text-muted-foreground">{t("common.certificateAbbr")}</dt>
                      <dd className="technical-id">{standard.calibrationCertNumber}</dd>
                      <dt className="text-muted-foreground">{t("dashboard.validTo")}</dt>
                      <dd className="technical-id">{isoDate(standard.calibrationExpiresAt)}</dd>
                    </dl>
                    <div
                      className={cn(
                        "technical-id mt-5 border-t pt-4 text-sm font-semibold",
                        state === "valid" && "text-success",
                        state === "soon" && "text-warning",
                        state === "expired" && "text-destructive"
                      )}
                    >
                      {state === "expired"
                        ? t("dashboard.expired")
                        : t("dashboard.days", { count: daysRemaining })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

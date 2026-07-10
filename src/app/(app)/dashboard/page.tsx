import Link from "next/link";
import { requireAuth } from "@/server/auth";
import { prisma } from "@/server/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, FilePlus, CheckCircle2, Clock } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { getTranslations } from "@/lib/i18n-server";

export default async function DashboardPage() {
  const session = await requireAuth();
  const { locale, t } = await getTranslations();

  const [totalDraft, totalSubmitted, recent] = await Promise.all([
    prisma.report.count({
      where: { preparedById: session.user.id, status: "DRAFT" },
    }),
    prisma.report.count({
      where: { preparedById: session.user.id, status: "SUBMITTED" },
    }),
    prisma.report.findMany({
      where: { preparedById: session.user.id },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: {
        filler: { include: { model: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t("dashboard.welcome", { name: session.user.name?.split(" ")[0] ?? "" })}
          </h1>
          <p className="text-muted-foreground">
            {session.user.title}
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/reports/new">
            <FilePlus className="h-5 w-5" />
            {t("dashboard.newReport")}
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("dashboard.drafts")}
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalDraft}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("dashboard.submitted")}
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalSubmitted}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("dashboard.total")}
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {totalDraft + totalSubmitted}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.recent")}</CardTitle>
          <CardDescription>{t("dashboard.latestFive")}</CardDescription>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>{t("dashboard.empty")}</p>
              <p className="text-sm mt-1">{t("dashboard.emptyCta")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recent.map((r) => (
                <Link
                  key={r.id}
                  href={
                    r.status === "DRAFT"
                      ? `/reports/${r.id}/wizard/info`
                      : `/reports/${r.id}`
                  }
                  className="flex items-center justify-between rounded-md border p-3 hover:bg-accent transition-colors"
                >
                  <div>
                    <div className="font-medium text-sm">{r.reportNumber}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.filler.clientName} · {r.filler.model.name} #
                      {r.filler.serialNumber} · {formatDate(r.serviceDate, locale)}
                    </div>
                  </div>
                  <span
                    className={
                      r.status === "SUBMITTED"
                        ? "text-xs font-medium px-2 py-1 rounded-full bg-success-muted text-success"
                        : "text-xs font-medium px-2 py-1 rounded-full bg-muted text-muted-foreground"
                    }
                  >
                    {r.status === "SUBMITTED"
                      ? t("reports.status.submitted")
                      : t("reports.status.draft")}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

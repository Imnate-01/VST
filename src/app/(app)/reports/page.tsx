import Link from "next/link";
import { requireAuth } from "@/server/auth";
import { prisma } from "@/server/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FilePlus, FileText } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { getTranslations } from "@/lib/i18n-server";

export default async function ReportsPage() {
  const session = await requireAuth();
  const { locale, t } = await getTranslations();

  const where =
    session.user.role === "ADMIN" ? {} : { preparedById: session.user.id };

  const reports = await prisma.report.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      filler: { include: { model: true } },
      preparedBy: { select: { name: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("reports.title")}</h1>
          <p className="text-muted-foreground">
            {t(reports.length === 1 ? "reports.countOne" : "reports.countMany", {
              count: reports.length,
            })}
          </p>
        </div>
        <Button asChild>
          <Link href="/reports/new">
            <FilePlus className="h-4 w-4" />
            {t("dashboard.newReport")}
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {reports.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <FileText className="mx-auto mb-3 h-12 w-12 opacity-30" />
              <p>{t("reports.empty")}</p>
              <Button asChild className="mt-4">
                <Link href="/reports/new">{t("reports.createFirst")}</Link>
              </Button>
            </div>
          ) : (
            <div className="table-shell rounded-none border-0 shadow-none">
              <table className="table-modern min-w-[900px]">
                <thead>
                  <tr>
                    <th>{t("reports.column.report")}</th>
                    <th>{t("reports.column.client")}</th>
                    <th>{t("reports.column.serial")}</th>
                    <th>{t("reports.column.date")}</th>
                    <th>{t("reports.column.status")}</th>
                    <th>{t("reports.column.preparedBy")}</th>
                    <th className="text-right">{t("reports.column.action")}</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => {
                    const href =
                      report.status === "DRAFT"
                        ? `/reports/${report.id}/wizard/info`
                        : `/reports/${report.id}`;

                    return (
                      <tr key={report.id}>
                        <td className="font-semibold text-sig-900">
                          {report.reportNumber}
                        </td>
                        <td>{report.filler.clientName}</td>
                        <td className="tabular text-muted-foreground">
                          {report.filler.model.name} #{report.filler.serialNumber}
                        </td>
                        <td className="tabular">{formatDate(report.serviceDate, locale)}</td>
                        <td>
                          <span
                            className={
                              report.status === "SUBMITTED"
                                ? "inline-flex rounded-full bg-success-muted px-2.5 py-1 text-xs font-semibold text-success"
                                : "inline-flex rounded-full bg-sig-100 px-2.5 py-1 text-xs font-semibold text-sig-800"
                            }
                          >
                            {report.status === "SUBMITTED"
                              ? t("reports.status.submitted")
                              : t("reports.status.draft")}
                          </span>
                        </td>
                        <td>{report.preparedBy.name}</td>
                        <td className="text-right">
                          <Button asChild variant="outline" size="sm">
                            <Link href={href}>
                              {report.status === "DRAFT"
                                ? t("common.continue")
                                : t("common.view")}
                            </Link>
                          </Button>
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
    </div>
  );
}

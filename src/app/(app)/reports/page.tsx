import Link from "next/link";
import { FilePlus } from "lucide-react";
import { requireAuth } from "@/server/auth";
import { prisma } from "@/server/db";
import { Button } from "@/components/ui/button";
import { ReportHistory, type ReportHistoryItem } from "@/components/report/report-history";
import { getTranslations } from "@/lib/i18n-server";

export default async function ReportsPage() {
  const session = await requireAuth();
  const { t } = await getTranslations();
  const where = session.user.role === "ADMIN" ? {} : { preparedById: session.user.id };

  const reports = await prisma.report.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      filler: { include: { model: true } },
      preparedBy: { select: { name: true } },
      deviceSelections: { select: { id: true } },
      standards: { select: { id: true } },
      certificates: {
        select: {
          overallStatus: true,
          measurements: { select: { status: true } },
        },
      },
    },
  });

  const items: ReportHistoryItem[] = reports.map((report) => {
    const passedCertificates = report.certificates.filter(
      (certificate) => certificate.overallStatus === "PASS"
    ).length;
    const failCount = report.certificates.reduce(
      (total, certificate) =>
        total + certificate.measurements.filter((measurement) => measurement.status === "FAIL").length,
      0
    );

    let progressStep = 1;
    let progressKey: ReportHistoryItem["progressKey"] = "info";
    if (report.deviceSelections.length > 0) {
      progressStep = 2;
      progressKey = "devices";
    }
    if (report.standards.length > 0) {
      progressStep = 3;
      progressKey = "standards";
    }
    if (report.certificates.length > 0) {
      progressStep = Math.min(7, 4 + passedCertificates);
      progressKey = "calibration";
    }

    return {
      id: report.id,
      reportNumber: report.reportNumber,
      status: report.status,
      clientName: report.filler.clientName,
      fillerModel: report.filler.model.name,
      serialNumber: report.filler.serialNumber,
      serviceDate: report.serviceDate.toISOString(),
      preparedBy: report.preparedBy.name,
      progressStep,
      progressKey,
      passedCertificates,
      totalCertificates: report.certificates.length,
      failCount,
    };
  });

  const drafts = items.filter((report) => report.status === "DRAFT").length;

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-5 border-b pb-8 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-4xl font-bold leading-tight">{t("reports.title")}</h1>
          <p className="mt-1 text-lg text-muted-foreground">
            {t("reports.summary", { count: reports.length, drafts })}
          </p>
        </div>
        <Button asChild size="lg" className="shrink-0 sm:mt-1">
          <Link href="/reports/new">
            <FilePlus className="h-5 w-5" />
            {t("dashboard.newReport")}
          </Link>
        </Button>
      </header>

      <ReportHistory reports={items} showEngineer={session.user.role === "ADMIN"} />
    </div>
  );
}

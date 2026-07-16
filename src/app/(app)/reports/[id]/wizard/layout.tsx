import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireAuth } from "@/server/auth";
import { getReportForWizard } from "@/server/services/reports";
import { getReportProgress } from "@/server/services/report-progress";
import { ReportStatusBadge } from "@/components/report/report-status-badge";
import { WizardNav, type WizardNavProgress } from "@/components/wizard/wizard-nav";
import { getTranslations } from "@/lib/i18n-server";
import { formatDateInput } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

export default async function ReportWizardLayout({ children, params }: Props) {
  const { id } = await params;
  const session = await requireAuth();
  const { t } = await getTranslations();
  const actor = { id: session.user.id, role: session.user.role };
  const [data, progress] = await Promise.all([
    getReportForWizard(id, actor),
    getReportProgress(id, actor),
  ]);

  if (!data || !progress) notFound();

  const navProgress: WizardNavProgress = {
    checklist: progress.checklist,
    instruments: progress.instruments,
    certificates: Object.fromEntries(
      progress.certificates.map((certificate) => [
        certificate.certificateType,
        certificate.complete,
      ])
    ),
    review: progress.review,
    reviewEnabled: progress.reviewEnabled,
  };

  return (
    <div className="space-y-0">
      <header className="pb-6">
        <Link
          href="/reports"
          className="mb-5 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          {t("nav.reports")}
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <h1 className="technical-id text-2xl font-semibold text-foreground sm:text-3xl">
            {data.report.reportNumber}
          </h1>
          <ReportStatusBadge status="DRAFT" label={t("reports.status.draft")} />
        </div>

        <dl className="mt-6 grid max-w-3xl gap-x-10 gap-y-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">{t("wizard.client")}</dt>
            <dd className="mt-1 font-medium text-foreground">
              {data.report.filler.clientName} — {data.report.filler.clientCity}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("wizard.filler")}</dt>
            <dd className="technical-id mt-1 font-medium text-foreground">
              {data.report.filler.model.name} · SN {data.report.filler.serialNumber}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("wizard.service")}</dt>
            <dd className="technical-id mt-1 font-medium text-foreground">
              {formatDateInput(data.report.serviceDate)}
            </dd>
          </div>
        </dl>
      </header>

      <WizardNav reportId={id} progress={navProgress} />
      <div className="mx-auto w-full max-w-6xl pt-10">{children}</div>
    </div>
  );
}

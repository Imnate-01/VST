import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAuth } from "@/server/auth";
import { getReportForWizard } from "@/server/services/reports";
import { Button } from "@/components/ui/button";
import { WizardNav } from "@/components/wizard/wizard-nav";
import { getTranslations } from "@/lib/i18n-server";

type Props = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

export default async function ReportWizardLayout({ children, params }: Props) {
  const { id } = await params;
  const session = await requireAuth();
  const { t } = await getTranslations();
  const data = await getReportForWizard(id, {
    id: session.user.id,
    role: session.user.role,
  });

  if (!data) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-3 mb-2">
            <Link href="/reports">
              <ArrowLeft className="h-4 w-4" />
              {t("nav.reports")}
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">{t("wizard.title")}</h1>
          <p className="text-muted-foreground">
            {data.report.reportNumber} · {data.report.filler.clientName} ·{" "}
            {data.report.filler.model.name} #{data.report.filler.serialNumber}
          </p>
        </div>
      </div>

      <WizardNav reportId={id} />
      {children}
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Circle, Clock3, PenLine } from "lucide-react";
import { requireAuth } from "@/server/auth";
import { prisma } from "@/server/db";
import { getReportProgress } from "@/server/services/report-progress";
import { getReportForWizard } from "@/server/services/reports";
import { certificateHref, getCertificateLabel } from "@/lib/certificates";
import type { SectionState } from "@/server/domain/report-progress";
import { ReportSignatureBlock } from "@/components/report/signature-blocks";
import { SubmitReportBlock } from "@/components/report/submit-report-block";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getTranslations } from "@/lib/i18n-server";
import { cn } from "@/lib/utils";
import type { MessageKey } from "@/lib/i18n";

type Props = {
  params: Promise<{ id: string }>;
};

const stateLabelKeys: Record<SectionState, MessageKey> = {
  not_started: "review.notStarted",
  pending_capture: "review.pendingCapture",
  pending_signature: "review.pendingSignature",
  signed: "review.signed",
};

function StateIcon({ state }: { state: SectionState }) {
  if (state === "signed") {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white">
        <Check className="h-4 w-4" aria-hidden="true" />
      </span>
    );
  }

  if (state === "pending_signature") {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-warning/25 bg-warning-muted text-warning">
        <PenLine className="h-4 w-4" aria-hidden="true" />
      </span>
    );
  }

  if (state === "pending_capture") {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
        <Clock3 className="h-4 w-4" aria-hidden="true" />
      </span>
    );
  }

  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
      <Circle className="h-3.5 w-3.5" aria-hidden="true" />
    </span>
  );
}

export default async function ReviewWizardPage({ params }: Props) {
  const { id } = await params;
  const session = await requireAuth();
  const { locale, t } = await getTranslations();
  const actor = { id: session.user.id, role: session.user.role };

  const [data, progress] = await Promise.all([
    getReportForWizard(id, actor),
    getReportProgress(id, actor),
  ]);

  if (!data || !progress) notFound();

  const blockedReason = progress.readyToSignReport
    ? null
    : progress.pendingCount === 1
      ? t("review.blockedBySectionsOne")
      : t("review.blockedBySections", { count: progress.pendingCount });

  const reportSignature = await prisma.signature.findFirst({
    where: { reportId: id, certificateId: null, revoked: false },
    include: { signer: { select: { name: true, title: true } } },
    orderBy: { signedAt: "desc" },
  });

  const sections = progress.certificates.filter((certificate) => certificate.exists);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t("review.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("review.description")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("review.sectionsTitle")}</CardTitle>
          <CardDescription>{t("review.sectionsDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sections.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("review.noCertificates")}</p>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground">
                {t("review.progress", {
                  signed: progress.signedCount,
                  total: progress.totalCount,
                })}
              </p>

              <ul className="divide-y rounded-lg border">
                {sections.map((section) => (
                  <li
                    key={section.certificateType}
                    className="flex items-center justify-between gap-4 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <StateIcon state={section.state} />
                      <div>
                        <div className="text-sm font-semibold text-foreground">
                          {getCertificateLabel(section.certificateType, locale)}
                        </div>
                        <div
                          className={cn(
                            "text-xs",
                            section.complete ? "text-muted-foreground" : "text-warning"
                          )}
                        >
                          {t(stateLabelKeys[section.state])}
                        </div>
                      </div>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link href={certificateHref(id, section.certificateType)}>
                        {section.complete ? t("review.open") : t("common.edit")}
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>

              <p
                className={cn(
                  "rounded-lg border px-3 py-2 text-xs",
                  progress.readyToSignReport
                    ? "border-success/25 bg-success-muted text-success"
                    : "border-warning/25 bg-warning-muted text-warning"
                )}
              >
                {progress.readyToSignReport ? t("review.readyToSign") : blockedReason}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <ReportSignatureBlock
        reportId={id}
        existing={
          reportSignature && {
            signatureImageUrl: reportSignature.signatureImageUrl,
            signedAt: reportSignature.signedAt,
            signerName: reportSignature.signer.name,
            signerTitle: reportSignature.signer.title,
          }
        }
        blockedReason={blockedReason}
      />

      <SubmitReportBlock
        reportId={id}
        blockedReason={
          blockedReason ?? (reportSignature ? null : t("review.submitBlockedSignature"))
        }
      />

      <div className="flex justify-end">
        <Button asChild variant="outline">
          <Link href={`/reports/${data.report.id}`}>{t("reports.openReport")}</Link>
        </Button>
      </div>
    </div>
  );
}

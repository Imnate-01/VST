import Link from "next/link";
import { notFound } from "next/navigation";
import { CertificateType } from "@prisma/client";
import { requireAuth } from "@/server/auth";
import { prisma } from "@/server/db";
import { certificateHref, getCertificateConfig, getCertificateLabel } from "@/lib/certificates";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { getTranslations } from "@/lib/i18n-server";

type Props = {
  params: Promise<{ id: string }>;
};

function getCertificateHref(reportId: string, certificateType: CertificateType) {
  if (!getCertificateConfig(certificateType).implemented) {
    return `/reports/${reportId}`;
  }

  return certificateHref(reportId, certificateType);
}

export default async function ReportDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await requireAuth();
  const { locale, t } = await getTranslations();
  const report = await prisma.report.findFirst({
    where: {
      id,
      ...(session.user.role === "ADMIN" ? {} : { preparedById: session.user.id }),
    },
    include: {
      filler: { include: { model: true } },
      preparedBy: { select: { name: true, title: true } },
      certificates: { include: { primaryStandard: true }, orderBy: { certificateType: "asc" } },
    },
  });

  if (!report) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="technical-id text-3xl font-bold">{report.reportNumber}</h1>
          <p className="text-muted-foreground">
            {report.filler.clientName} · {report.filler.model.name} #
            {report.filler.serialNumber}
          </p>
        </div>
        <div className="flex gap-2">
          {/* Enviado: el PDF archivado es el documento oficial, no una vista previa. */}
          {report.pdfUrl ? (
            <Button asChild variant="outline">
              <Link href={report.pdfUrl} target="_blank" prefetch={false}>
                {t("review.viewFinalPdf")}
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link href={`/reports/${report.id}/pdf`} target="_blank" prefetch={false}>
                {t("reports.viewPdf")}
              </Link>
            </Button>
          )}
          {report.status === "DRAFT" && (
            <Button asChild>
              <Link href={`/reports/${report.id}/wizard/info`}>
                {t("reports.continueWizard")}
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("report.statusTitle")}</CardTitle>
          <CardDescription>
            {t("report.statusDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm md:grid-cols-2">
          <div>
            <div className="text-muted-foreground">{t("reports.column.status")}</div>
            <div className="font-medium">
              {report.status === "SUBMITTED"
                ? t("reports.status.submitted")
                : t("reports.status.draft")}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">{t("report.serviceDate")}</div>
            <div className="font-medium">{formatDate(report.serviceDate, locale)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">{t("reports.column.preparedBy")}</div>
            <div className="font-medium">
              {report.preparedBy.name} · {report.preparedBy.title}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">{t("report.baseCertificates")}</div>
            <div className="font-medium">{report.certificates.length}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("report.preparedTypes")}</CardTitle>
        </CardHeader>
        <CardContent>
          {report.certificates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("report.noCertificates")}
            </p>
          ) : (
            <div className="divide-y rounded-lg border">
              {report.certificates.map((certificate) => (
                <div
                  key={certificate.id}
                  className="flex flex-col gap-3 p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="font-medium">
                      {getCertificateLabel(certificate.certificateType, locale)}
                    </div>
                    <div className="text-muted-foreground">
                      {t("report.standard")}: {certificate.primaryStandard.descriptionSnapshot} ·{" "}
                      {t("common.serialAbbr")} {certificate.primaryStandard.serialSnapshot} ·{" "}
                      {t("common.certificateAbbr")} {certificate.primaryStandard.certNumberSnapshot} ·{" "}
                      {t("report.certificateStatus")} {" "}
                      {certificate.overallStatus === "PASS"
                        ? t("measurement.pass")
                        : certificate.overallStatus === "FAIL"
                          ? t("measurement.fail")
                          : certificate.overallStatus === "MIXED"
                            ? t("measurement.mixed")
                            : t("measurement.pending")}
                    </div>
                  </div>
                  {report.status === "DRAFT" && (
                    <Button asChild variant="outline" size="sm">
                      <Link href={getCertificateHref(report.id, certificate.certificateType)}>
                        {t("report.editMeasurements")}
                      </Link>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

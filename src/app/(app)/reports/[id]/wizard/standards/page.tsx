import { notFound } from "next/navigation";
import { requireAuth } from "@/server/auth";
import { getStandardsWizardData } from "@/server/services/reports";
import { StepStandardsForm } from "@/components/wizard/step-standards-form";
import { formatDate } from "@/lib/utils";
import { getLocale } from "@/lib/i18n-server";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function WizardStandardsPage({ params }: Props) {
  const { id } = await params;
  const session = await requireAuth();
  const locale = await getLocale();
  const data = await getStandardsWizardData(id, {
    id: session.user.id,
    role: session.user.role,
  });

  if (!data) notFound();

  const existingByType = new Map(
    data.certificates.map((certificate) => [
      certificate.certificateType,
      {
        primary: certificate.primaryStandard.standardInstrumentId,
        additional: certificate.additionalStandards.map(
          (link) => link.reportStandard.standardInstrumentId
        ),
      },
    ])
  );

  return (
    <StepStandardsForm
      reportId={data.report.id}
      requiredTypes={data.requiredTypes}
      serviceDateLabel={formatDate(data.report.serviceDate, locale)}
      standards={data.standardInstruments.map((standard) => ({
        id: standard.id,
        description: standard.description,
        manufacturer: standard.manufacturer,
        model: standard.model,
        serialNumber: standard.serialNumber,
        certificationStatus: standard.certificationStatus,
        calibrationCertNumber: standard.calibrationCertNumber,
        calibrationDate: standard.calibrationDate?.toISOString() ?? null,
        calibrationExpiresAt: standard.calibrationExpiresAt?.toISOString() ?? null,
        expiredForServiceDate:
          standard.certificationStatus === "CERTIFIED" &&
          Boolean(
            standard.calibrationExpiresAt &&
              standard.calibrationExpiresAt <= data.report.serviceDate
          ),
        unavailableForReport: standard.certificationStatus === "PENDING",
      }))}
      initialValues={{
        reportId: data.report.id,
        standards: data.requiredTypes.map((certificateType) => ({
          certificateType,
          standardInstrumentId: existingByType.get(certificateType)?.primary ?? "",
          additionalStandardInstrumentIds:
            existingByType.get(certificateType)?.additional ?? [],
        })),
      }}
    />
  );
}

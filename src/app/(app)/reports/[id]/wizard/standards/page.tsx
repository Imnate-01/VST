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
      certificate.primaryStandard.standardInstrumentId,
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
        calibrationCertNumber: standard.calibrationCertNumber,
        calibrationDate: standard.calibrationDate.toISOString(),
        calibrationExpiresAt: standard.calibrationExpiresAt.toISOString(),
        expiredForServiceDate: standard.calibrationExpiresAt <= data.report.serviceDate,
      }))}
      initialValues={{
        reportId: data.report.id,
        standards: data.requiredTypes.map((certificateType) => ({
          certificateType,
          standardInstrumentId: existingByType.get(certificateType) ?? "",
        })),
      }}
    />
  );
}

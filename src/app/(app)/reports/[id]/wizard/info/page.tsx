import { notFound } from "next/navigation";
import { requireAuth } from "@/server/auth";
import { getReportForWizard } from "@/server/services/reports";
import { StepInfoForm } from "@/components/wizard/step-info-form";
import { formatDateInput } from "@/lib/utils";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function WizardInfoPage({ params }: Props) {
  const { id } = await params;
  const session = await requireAuth();
  const data = await getReportForWizard(id, {
    id: session.user.id,
    role: session.user.role,
  });

  if (!data) notFound();

  return (
    <StepInfoForm
      initialValues={{
        reportId: data.report.id,
        serviceDate: formatDateInput(data.report.serviceDate),
        fillerId: data.report.fillerId,
        observations: data.report.observations ?? "",
      }}
      fillers={data.fillers.map((filler) => ({
        id: filler.id,
        serialNumber: filler.serialNumber,
        clientName: filler.clientName,
        clientAddress: filler.clientAddress,
        clientCity: filler.clientCity,
        clientState: filler.clientState,
        clientZip: filler.clientZip,
        modelName: filler.model.name,
      }))}
    />
  );
}

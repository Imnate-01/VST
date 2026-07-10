import { notFound } from "next/navigation";
import { requireAuth } from "@/server/auth";
import { getDeviceWizardData } from "@/server/services/reports";
import { getCertificateLabel } from "@/lib/certificates";
import { StepDevicesForm } from "@/components/wizard/step-devices-form";
import { getLocale } from "@/lib/i18n-server";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function WizardDevicesPage({ params }: Props) {
  const { id } = await params;
  const session = await requireAuth();
  const locale = await getLocale();
  const data = await getDeviceWizardData(id, {
    id: session.user.id,
    role: session.user.role,
  });

  if (!data) notFound();

  const selectionByDeviceId = new Map(
    data.selections.map((selection) => [selection.deviceCatalogId, selection])
  );

  return (
    <StepDevicesForm
      reportId={data.report.id}
      devices={data.devices.map((device) => ({
        id: device.id,
        tagNumber: device.tagNumber,
        description: device.description,
        deviceType: device.deviceType,
        tolerance: `${device.toleranceIsPercent ? "± " : "± "}${device.toleranceValue.toString()}${
          device.toleranceIsPercent ? "% " : " "
        }${device.toleranceUnit}`,
        certificateType: device.certificateTypes
          .map((type) => getCertificateLabel(type, locale))
          .join(" · "),
      }))}
      initialValues={{
        reportId: data.report.id,
        selections: data.devices.map((device) => {
          const selection = selectionByDeviceId.get(device.id);

          return {
            deviceCatalogId: device.id,
            included: selection?.included ?? true,
            exclusionReason: selection?.exclusionReason ?? "",
          };
        }),
      }}
    />
  );
}

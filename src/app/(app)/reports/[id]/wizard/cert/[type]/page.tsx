import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/server/auth";
import { getCertificateForWizard } from "@/server/services/certificates";
import { getActiveCertificateSignature } from "@/server/services/signatures";
import {
  getCertificateConfig,
  getCertificateLabel,
  getDefaultTargets,
  getNextCertificateHref,
  parseCertificateRouteType,
} from "@/lib/certificates";
import { getTranslations } from "@/lib/i18n-server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type MeasurementRow,
} from "@/components/wizard/step-certificate-form";
import { CertificateStep } from "@/components/wizard/certificate-step";
import { hasCompleteCertificateMeasurement } from "@/server/domain/certificate-completeness";

type Props = {
  params: Promise<{ id: string; type: string }>;
};

function decimalToString(value: { toString(): string } | null | undefined) {
  return value ? value.toString() : "";
}

function cleanUnit(unit: string) {
  return unit.replace("Â°C", "°C").replace("Â°", "°");
}

export default async function CertificateWizardPage({ params }: Props) {
  const { id, type } = await params;
  const certificateType = parseCertificateRouteType(type);
  if (!certificateType) notFound();

  const config = getCertificateConfig(certificateType);
  const { locale, t } = await getTranslations();
  const session = await requireAuth();
  const data = await getCertificateForWizard(id, certificateType, {
    id: session.user.id,
    role: session.user.role,
  });

  if (!data) notFound();

  const title = t("certificate.suffix", {
    name: getCertificateLabel(certificateType, locale),
  });

  if (!data.certificate) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            {t("certificate.missing")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("certificate.missingHelp")}
          </p>
          <Button asChild>
            <Link href={`/reports/${id}/wizard/standards`}>
              {t("certificate.goStandards")}
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (data.deviceSelections.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            {t("certificate.noDevices")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href={`/reports/${id}/wizard/devices`}>
              {t("certificate.reviewDevices")}
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const measurementByDeviceSelectionId = new Map(
    data.measurements.map((measurement) => [measurement.deviceSelectionId, measurement])
  );

  const initialMeasurements = data.deviceSelections.map((selection) => {
    const measurement = measurementByDeviceSelectionId.get(selection.id);
    const defaults = getDefaultTargets({
      certificateType,
      description: selection.descriptionSnapshot,
    });
    const savedPointByKind = new Map(
      (measurement?.points ?? []).map((point) => [point.kind, point])
    );

    return {
      deviceSelectionId: selection.id,
      points: config.pointKinds.map((kind) => {
        const saved = savedPointByKind.get(kind);

        return {
          kind,
          conditionValue: decimalToString(saved?.conditionValue),
          targetNominal: decimalToString(saved?.targetNominal) || defaults[kind] || "",
          asFoundReference: decimalToString(saved?.asFoundReference),
          asFoundReading: decimalToString(saved?.asFoundReading),
          asLeftReference: decimalToString(saved?.asLeftReference),
          asLeftReading: decimalToString(saved?.asLeftReading),
        };
      }),
    };
  });

  const rows: MeasurementRow[] = data.deviceSelections.map((selection) => {
    const measurement = measurementByDeviceSelectionId.get(selection.id);
    const unit = cleanUnit(selection.toleranceUnitSnapshot);
    const toleranceValue = selection.toleranceValueSnapshot.toString();
    const tolerance = selection.toleranceIsPercentSnapshot
      ? `± ${toleranceValue}% ${unit}`
      : `± ${toleranceValue} ${unit}`;

    return {
      deviceSelectionId: selection.id,
      tagNumber: selection.tagNumberSnapshot,
      description: selection.descriptionSnapshot,
      tolerance,
      toleranceValue,
      toleranceIsPercent: selection.toleranceIsPercentSnapshot,
      toleranceUnit: unit,
      status: measurement?.status ?? "PENDING",
      statusReason: measurement?.statusReason ?? "",
      requiredAdjustment: measurement?.requiredAdjustment ?? false,
    };
  });

  const signature = await getActiveCertificateSignature(data.certificate.id);
  const measurementsComplete =
    data.measurements.length === data.deviceSelections.length &&
    data.measurements.every((measurement) =>
      hasCompleteCertificateMeasurement(certificateType, measurement.points)
    );
  const certificateReadyToSign =
    measurementsComplete && data.certificate.overallStatus !== "PENDING";

  return (
    <CertificateStep
      title={title}
      description={t("certificate.captureDescription", {
        report: data.report.reportNumber,
        standard: data.certificate.primaryStandard.descriptionSnapshot,
        serial: data.certificate.primaryStandard.serialSnapshot,
      })}
      reportId={data.report.id}
      certificateId={data.certificate.id}
      certificateType={certificateType}
      rows={rows}
      initialValues={{
        reportId: data.report.id,
        certificateId: data.certificate.id,
        certificateType,
        measurements: initialMeasurements,
      }}
      initialReadyToSign={certificateReadyToSign}
      signature={
        signature && {
          signatureImageUrl: signature.signatureImageUrl,
          signedAt: signature.signedAt,
          signerName: signature.signer.name,
          signerTitle: signature.signer.title,
        }
      }
      nextHref={getNextCertificateHref({
        reportId: data.report.id,
        certificateType,
      })}
    />
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { CertificateLayout, CertificateType } from "@prisma/client";
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
import {
  hasCompleteTestReadings,
  hasCompleteVerificationRows,
} from "@/server/domain/certificate-completeness";

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

  if (
    data.deviceSelections.length === 0 &&
    config.layout !== CertificateLayout.VERIFICATION
  ) {
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
  const signatureView =
    signature && {
      signatureImageUrl: signature.signatureImageUrl,
      signedAt: signature.signedAt,
      signerName: signature.signer.name,
      signerTitle: signature.signer.title,
    };
  const commonProps = {
    title,
    description: t("certificate.captureDescription", {
      report: data.report.reportNumber,
      standard: data.certificate.primaryStandard.descriptionSnapshot,
      serial: data.certificate.primaryStandard.serialSnapshot,
    }),
    reportId: data.report.id,
    certificateId: data.certificate.id,
    certificateType,
    signature: signatureView,
    nextHref: getNextCertificateHref({
      reportId: data.report.id,
      certificateType,
    }),
  };

  if (config.layout === CertificateLayout.TEST_READINGS) {
    const storedParams = (data.certificate.params ?? {}) as Record<
      string,
      unknown
    >;
    const stringParam = (key: string, fallback: string) =>
      typeof storedParams[key] === "string"
        ? (storedParams[key] as string)
        : fallback;
    const testType = certificateType;
    const readingCount = config.testReadingCount ?? 2;
    const initialMeasurements = data.deviceSelections.map((selection) => {
      const saved = measurementByDeviceSelectionId.get(selection.id);
      const savedBySequence = new Map(
        (saved?.readings ?? []).map((reading) => [reading.sequence, reading])
      );

      return {
        deviceSelectionId: selection.id,
        notes: saved?.notes ?? "",
        readings: Array.from({ length: readingCount }, (_, index) => {
          const sequence = index + 1;
          return {
            sequence,
            value: decimalToString(savedBySequence.get(sequence)?.value),
          };
        }),
      };
    });
    const params = {
      meteringRate:
        testType === CertificateType.METERING_PUMP_CHAMBER
          ? stringParam("meteringRate", "7.5")
          : testType === CertificateType.METERING_PUMP_TUNNEL
            ? stringParam("meteringRate", "20")
            : "",
      durationMinutes:
        testType === CertificateType.ULTRASONIC
          ? ""
          : stringParam("durationMinutes", "5"),
      targetWeight:
        testType === CertificateType.ULTRASONIC
          ? stringParam("targetWeight", "124")
          : "",
      material: stringParam(
        "material",
        "Minimum 34% Hydrogen Peroxide"
      ),
    };
    const complete =
      data.measurements.length === data.deviceSelections.length &&
      data.measurements.every((measurement) =>
        hasCompleteTestReadings(readingCount, measurement.readings)
      );

    return (
      <CertificateStep
        {...commonProps}
        mode="TEST_READINGS"
        certificateType={testType}
        rows={rows}
        initialValues={{
          reportId: data.report.id,
          certificateId: data.certificate.id,
          certificateType: testType,
          params,
          measurements: initialMeasurements,
        }}
        initialReadyToSign={
          complete && data.certificate.overallStatus !== "PENDING"
        }
      />
    );
  }

  if (config.layout === CertificateLayout.VERIFICATION) {
    const defaultRows = [
      {
        motorTag: "250",
        description: "AUX 1 EXHAUST MOTOR",
        rowLabel: "Filling Area Actual Reading",
        notApplicable: false,
        displayOrder: 10,
        notes: "",
      },
      {
        motorTag: "250",
        description: "AUX 1 EXHAUST MOTOR",
        rowLabel: "Assembly Area Actual Reading",
        notApplicable: true,
        displayOrder: 20,
        notes: "",
      },
      {
        motorTag: "255",
        description: "AUX 2 EXHAUST MOTOR",
        rowLabel: "Filling Area Actual Reading",
        notApplicable: false,
        displayOrder: 30,
        notes: "",
      },
      {
        motorTag: "255",
        description: "AUX 2 EXHAUST MOTOR",
        rowLabel: "Assembly Area Actual Reading",
        notApplicable: true,
        displayOrder: 40,
        notes: "",
      },
      {
        motorTag: "260",
        description: "Lower Exhaust",
        rowLabel: "Actual Reading",
        notApplicable: false,
        displayOrder: 50,
        notes: "",
      },
    ];
    const verificationRows =
      data.certificate.verificationRows.length > 0
        ? [...data.certificate.verificationRows]
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map((row) => ({
              motorTag: row.motorTag,
              description: row.description,
              rowLabel: row.rowLabel,
              scfm: decimalToString(row.scfm),
              driveFrequencyHz: decimalToString(row.driveFrequencyHz),
              notApplicable: row.notApplicable,
              displayOrder: row.displayOrder,
              notes: row.notes ?? "",
            }))
        : defaultRows.map((row) => ({
            ...row,
            scfm: "",
            driveFrequencyHz: "",
          }));

    return (
      <CertificateStep
        {...commonProps}
        mode="VERIFICATION"
        certificateType={CertificateType.EXHAUST}
        initialValues={{
          reportId: data.report.id,
          certificateId: data.certificate.id,
          certificateType: CertificateType.EXHAUST,
          rows: verificationRows,
        }}
        initialReadyToSign={
          hasCompleteVerificationRows(verificationRows) &&
          data.certificate.overallStatus !== "PENDING"
        }
      />
    );
  }

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
      notes: measurement?.notes ?? "",
      points: config.pointKinds.map((kind) => {
        const saved = savedPointByKind.get(kind);

        return {
          kind,
          conditionValue: decimalToString(saved?.conditionValue),
          targetNominal:
            decimalToString(saved?.targetNominal) || defaults[kind] || "",
          asFoundReading: decimalToString(saved?.asFoundReading),
          asLeftReading: decimalToString(saved?.asLeftReading),
        };
      }),
    };
  });
  const measurementsComplete =
    data.measurements.length === data.deviceSelections.length &&
    data.measurements.every((measurement) =>
      hasCompleteCertificateMeasurement(certificateType, measurement.points)
    );

  return (
    <CertificateStep
      {...commonProps}
      mode="POINTS"
      rows={rows}
      initialValues={{
        reportId: data.report.id,
        certificateId: data.certificate.id,
        certificateType,
        measurements: initialMeasurements,
      }}
      initialReadyToSign={
        measurementsComplete && data.certificate.overallStatus !== "PENDING"
      }
    />
  );
}

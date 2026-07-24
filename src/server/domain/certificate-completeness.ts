import { CertificateType, PointKind } from "@prisma/client";
import { getCertificateConfig } from "@/lib/certificates";

type PointValue = string | number | { toString(): string } | null | undefined;

export type CompletenessPoint = {
  kind: PointKind;
  conditionValue?: PointValue;
  targetNominal?: PointValue;
  asFoundReading?: PointValue;
  asLeftReading?: PointValue;
};

type ReadingValue = {
  value?: PointValue;
  target?: PointValue;
};

type VerificationValue = {
  scfm?: PointValue;
  driveFrequencyHz?: PointValue;
  notApplicable: boolean;
};

function hasValue(value: PointValue): boolean {
  if (value === null || value === undefined) return false;
  return value.toString().trim() !== "";
}

/**
 * La captura puede guardarse parcialmente, pero un certificado solo está listo
 * para firmarse cuando todos sus puntos y campos visibles están completos.
 */
export function hasCompleteCertificateMeasurement(
  certificateType: CertificateType,
  points: CompletenessPoint[]
): boolean {
  const config = getCertificateConfig(certificateType);
  const pointByKind = new Map(points.map((point) => [point.kind, point]));

  if (pointByKind.size !== config.pointKinds.length) return false;

  return config.pointKinds.every((kind) => {
    const point = pointByKind.get(kind);
    if (!point) return false;

    return (
      (!config.conditionLabel || hasValue(point.conditionValue)) &&
      hasValue(point.targetNominal) &&
      hasValue(point.asFoundReading) &&
      hasValue(point.asLeftReading)
    );
  });
}

export function hasCompleteTestReadings(
  expectedCount: number,
  readings: ReadingValue[]
): boolean {
  if (readings.length !== expectedCount) return false;

  return readings.every(
    (reading) => hasValue(reading.target) && hasValue(reading.value)
  );
}

/**
 * En la plantilla de extracción, N/A aplica a la frecuencia del variador; la
 * lectura SCFM sigue siendo obligatoria.
 */
export function hasCompleteVerificationRows(
  rows: VerificationValue[]
): boolean {
  return (
    rows.length > 0 &&
    rows.every(
      (row) =>
        hasValue(row.scfm) &&
        (row.notApplicable || hasValue(row.driveFrequencyHz))
    )
  );
}

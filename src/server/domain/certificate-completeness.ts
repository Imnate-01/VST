import { CertificateType, PointKind } from "@prisma/client";
import { getCertificateConfig } from "@/lib/certificates";

type PointValue = string | number | { toString(): string } | null | undefined;

export type CompletenessPoint = {
  kind: PointKind;
  conditionValue?: PointValue;
  targetNominal?: PointValue;
  asFoundReference?: PointValue;
  asFoundReading?: PointValue;
  asLeftReference?: PointValue;
  asLeftReading?: PointValue;
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
      hasValue(point.asFoundReference) &&
      hasValue(point.asFoundReading) &&
      hasValue(point.asLeftReference) &&
      hasValue(point.asLeftReading)
    );
  });
}

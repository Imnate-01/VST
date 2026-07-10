import { createHash } from "node:crypto";

/**
 * Contenido firmado de un certificado o de un reporte.
 *
 * El hash sirve para detectar que lo firmado cambió después de la firma. Por eso
 * la serialización tiene que ser canónica: las mismas mediciones deben producir
 * siempre el mismo string, sin depender del orden en que la base devuelva filas
 * ni del orden de las claves de un objeto.
 */

export type SignedPoint = {
  kind: string;
  targetNominal: string | null;
  asFoundReference: string | null;
  asFoundReading: string | null;
  asLeftReference: string | null;
  asLeftReading: string | null;
};

export type SignedMeasurement = {
  tagNumber: string;
  status: string;
  requiredAdjustment: boolean;
  correctionMethod: string | null;
  points: SignedPoint[];
};

export type CertificateSignaturePayload = {
  scope: "certificate";
  reportNumber: string;
  certificateType: string;
  overallStatus: string;
  standardSerial: string;
  measurements: SignedMeasurement[];
};

export type ReportSignaturePayload = {
  scope: "report";
  reportNumber: string;
  serviceDate: string;
  fillerSerial: string;
  observations: string | null;
  /** Un par (tipo, hash de la firma del certificado) por certificado firmado. */
  certificates: Array<{ certificateType: string; payloadHash: string }>;
};

export type SignaturePayload = CertificateSignaturePayload | ReportSignaturePayload;

const POINT_ORDER = ["LOW", "HIGH", "SINGLE"];

function canonicalPoint(point: SignedPoint): unknown[] {
  return [
    point.kind,
    point.targetNominal,
    point.asFoundReference,
    point.asFoundReading,
    point.asLeftReference,
    point.asLeftReading,
  ];
}

function canonicalMeasurement(measurement: SignedMeasurement): unknown[] {
  const points = [...measurement.points].sort(
    (a, b) => POINT_ORDER.indexOf(a.kind) - POINT_ORDER.indexOf(b.kind)
  );

  return [
    measurement.tagNumber,
    measurement.status,
    measurement.requiredAdjustment,
    measurement.correctionMethod,
    points.map(canonicalPoint),
  ];
}

/**
 * Serializa el payload como un array anidado: la posición define el significado,
 * así que no hay ambigüedad por orden de claves.
 */
export function canonicalizePayload(payload: SignaturePayload): string {
  if (payload.scope === "certificate") {
    const measurements = [...payload.measurements].sort((a, b) =>
      a.tagNumber.localeCompare(b.tagNumber)
    );

    return JSON.stringify([
      "certificate",
      payload.reportNumber,
      payload.certificateType,
      payload.overallStatus,
      payload.standardSerial,
      measurements.map(canonicalMeasurement),
    ]);
  }

  const certificates = [...payload.certificates].sort((a, b) =>
    a.certificateType.localeCompare(b.certificateType)
  );

  return JSON.stringify([
    "report",
    payload.reportNumber,
    payload.serviceDate,
    payload.fillerSerial,
    payload.observations,
    certificates.map((certificate) => [
      certificate.certificateType,
      certificate.payloadHash,
    ]),
  ]);
}

export function hashSignaturePayload(payload: SignaturePayload): string {
  return createHash("sha256").update(canonicalizePayload(payload), "utf8").digest("hex");
}

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
  notes: string | null;
  points: SignedPoint[];
  readings?: Array<{
    sequence: number;
    value: string | null;
    target: string | null;
  }>;
};

export type CertificateSignaturePayload = {
  scope: "certificate";
  reportNumber: string;
  certificateType: string;
  overallStatus: string;
  standardSerial: string;
  /** Observaciones de la sección: se imprimen en la página que se firma. */
  notes: string | null;
  params?: unknown;
  measurements: SignedMeasurement[];
  verificationRows?: Array<{
    motorTag: string;
    description: string;
    rowLabel: string;
    scfm: string | null;
    driveFrequencyHz: string | null;
    notApplicable: boolean;
    displayOrder: number;
    notes: string | null;
  }>;
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
    measurement.notes,
    points.map(canonicalPoint),
    [...(measurement.readings ?? [])]
      .sort((a, b) => a.sequence - b.sequence)
      .map((reading) => [reading.sequence, reading.value, reading.target]),
  ];
}

function canonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, canonicalJson(child)])
    );
  }
  return value;
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
      payload.notes,
      canonicalJson(payload.params ?? null),
      measurements.map(canonicalMeasurement),
      [...(payload.verificationRows ?? [])]
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((row) => [
          row.motorTag,
          row.description,
          row.rowLabel,
          row.scfm,
          row.driveFrequencyHz,
          row.notApplicable,
          row.displayOrder,
          row.notes,
        ]),
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

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
  /**
   * Un punto N/A guarda todos sus valores en null, igual que uno vacío. Sin
   * este campo, declarar N/A no cambiaría el hash y la firma sobreviviría a un
   * cambio que sí se imprime en el certificado.
   */
  notApplicable: boolean;
  targetNominal: string | null;
  asFoundReference: string | null;
  asFoundReading: string | null;
  asLeftReference: string | null;
  asLeftReading: string | null;
};

/**
 * Patrón que respalda el certificado, con sus datos de certificación.
 *
 * Se firma el snapshot completo, no solo el número de serie: la página imprime
 * el certificado de calibración y su vigencia, y esos valores se refrescan cada
 * vez que se guarda el paso de instrumentos.
 */
export type SignedStandard = {
  role: "primary" | "additional";
  description: string;
  manufacturer: string;
  model: string;
  serial: string;
  certificationStatus: string;
  certNumber: string | null;
  calibrationDate: string | null;
  validTo: string | null;
};

export type SignedMeasurement = {
  tagNumber: string;
  /**
   * Identidad impresa del dispositivo. Va en el payload porque los snapshots se
   * refrescan desde el catálogo cada vez que se guarda el checklist: si un
   * admin edita la descripción o la tolerancia, la columna del certificado
   * cambia sin que nadie toque una medición.
   */
  description: string;
  toleranceValue: string;
  toleranceUnit: string;
  toleranceIsPercent: boolean;
  /** Posición de la columna en la tabla del certificado. */
  displayOrder: number;
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
  /** Todos los patrones de la sección, el principal primero. */
  standards: SignedStandard[];
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

/**
 * Fila del checklist: se imprime completa en la página de alcance, así que se
 * firma completa. Todos estos campos son snapshots que el paso de dispositivos
 * refresca desde el catálogo.
 */
export type SignedChecklistRow = {
  tagNumber: string;
  description: string;
  deviceType: string;
  toleranceValue: string;
  toleranceUnit: string;
  toleranceIsPercent: boolean;
  certificateTypes: string[];
  displayOrder: number;
  included: boolean;
  exclusionReason: string | null;
};

export type ReportSignaturePayload = {
  scope: "report";
  reportNumber: string;
  serviceDate: string;
  fillerSerial: string;
  observations: string | null;
  /**
   * Alcance del servicio. Va en el payload porque el reporte lo imprime: sin
   * esto, excluir un dispositivo cambiaría la página de alcance sin mover el
   * hash de la firma general.
   */
  checklist: SignedChecklistRow[];
  /** Un par (tipo, hash de la firma del certificado) por certificado firmado. */
  certificates: Array<{ certificateType: string; payloadHash: string }>;
};

export type SignaturePayload = CertificateSignaturePayload | ReportSignaturePayload;

const POINT_ORDER = ["LOW", "HIGH", "SINGLE"];

function canonicalPoint(point: SignedPoint): unknown[] {
  return [
    point.kind,
    point.notApplicable,
    point.targetNominal,
    point.asFoundReference,
    point.asFoundReading,
    point.asLeftReference,
    point.asLeftReading,
  ];
}

/**
 * El orden importa y no se reordena: es el orden en que los bloques de
 * validación salen impresos, con el principal arriba. El caller lo entrega ya
 * determinado por `displayOrder`.
 */
function canonicalStandard(standard: SignedStandard): unknown[] {
  return [
    standard.role,
    standard.description,
    standard.manufacturer,
    standard.model,
    standard.serial,
    standard.certificationStatus,
    standard.certNumber,
    standard.calibrationDate,
    standard.validTo,
  ];
}

function canonicalMeasurement(measurement: SignedMeasurement): unknown[] {
  const points = [...measurement.points].sort(
    (a, b) => POINT_ORDER.indexOf(a.kind) - POINT_ORDER.indexOf(b.kind)
  );

  return [
    measurement.tagNumber,
    measurement.description,
    measurement.toleranceValue,
    measurement.toleranceUnit,
    measurement.toleranceIsPercent,
    measurement.displayOrder,
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
      payload.standards.map(canonicalStandard),
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
    [...payload.checklist]
      .sort((a, b) => a.tagNumber.localeCompare(b.tagNumber))
      .map((row) => [
        row.tagNumber,
        row.description,
        row.deviceType,
        row.toleranceValue,
        row.toleranceUnit,
        row.toleranceIsPercent,
        [...row.certificateTypes].sort(),
        row.displayOrder,
        row.included,
        row.exclusionReason,
      ]),
    certificates.map((certificate) => [
      certificate.certificateType,
      certificate.payloadHash,
    ]),
  ]);
}

export function hashSignaturePayload(payload: SignaturePayload): string {
  return createHash("sha256").update(canonicalizePayload(payload), "utf8").digest("hex");
}

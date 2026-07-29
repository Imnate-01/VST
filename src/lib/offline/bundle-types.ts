import type {
  CertificateLayout,
  CertificateStatus,
  CertificateType,
  MeasurementStatus,
  PointKind,
  StandardCertificationStatus,
} from "@prisma/client";

/**
 * DTOs del "bundle offline" — la foto completa de un reporte que se descarga
 * para trabajar sin conexión. Todo Decimal viaja como string para serializar en
 * JSON sin pérdida. Estos tipos son client-safe (solo tipos de @prisma/client,
 * que se borran en compilación) y los comparten el endpoint y el repositorio.
 */

export type OfflineFillerSnapshot = {
  serialNumber: string;
  modelName: string;
  clientName: string;
  clientAddress: string;
  clientCity: string;
  clientState: string;
  clientZip: string;
};

export type OfflineReportMeta = {
  id: string;
  reportNumber: string;
  status: string;
  serviceDate: string; // ISO
  observations: string | null;
  filler: OfflineFillerSnapshot;
  preparedBy: { id: string; name: string; title: string; email: string };
  updatedAt: string; // ISO — guarda de last-write-wins
};

export type OfflineDeviceSelection = {
  id: string;
  tagNumberSnapshot: string;
  descriptionSnapshot: string;
  toleranceValueSnapshot: string;
  toleranceUnitSnapshot: string;
  toleranceIsPercentSnapshot: boolean;
  certificateTypesSnapshot: CertificateType[];
  displayOrderSnapshot: number;
};

export type OfflineStandard = {
  id: string;
  descriptionSnapshot: string;
  manufacturerSnapshot: string;
  modelSnapshot: string;
  serialSnapshot: string;
  certificationStatusSnapshot: StandardCertificationStatus;
  certNumberSnapshot: string | null;
  calDateSnapshot: string | null;
  calExpiresAtSnapshot: string | null;
};

export type OfflinePoint = {
  kind: PointKind;
  notApplicable: boolean;
  conditionValue: string | null;
  targetNominal: string | null;
  asFoundReference: string | null;
  asFoundReading: string | null;
  asFoundDeviation: string | null;
  asFoundInTolerance: boolean | null;
  asLeftReference: string | null;
  asLeftReading: string | null;
  asLeftDeviation: string | null;
  asLeftInTolerance: boolean | null;
};

export type OfflineReading = {
  sequence: number;
  value: string | null;
  target: string | null;
  deviation: string | null;
  inTolerance: boolean | null;
};

export type OfflineMeasurement = {
  deviceSelectionId: string;
  notes: string | null;
  correctionMethod: string | null;
  requiredAdjustment: boolean;
  status: MeasurementStatus;
  statusReason: string | null;
  points: OfflinePoint[];
  readings: OfflineReading[];
};

export type OfflineVerificationRow = {
  motorTag: string;
  description: string;
  rowLabel: string;
  scfm: string | null;
  driveFrequencyHz: string | null;
  notApplicable: boolean;
  displayOrder: number;
  notes: string | null;
};

export type OfflineCertificate = {
  id: string;
  certificateType: CertificateType;
  layout: CertificateLayout;
  params: Record<string, unknown> | null;
  overallStatus: CertificateStatus;
  primaryStandard: {
    descriptionSnapshot: string;
    serialSnapshot: string;
  };
  /** Patrones complementarios, en el orden en que se declararon. */
  additionalStandards: Array<{
    descriptionSnapshot: string;
    serialSnapshot: string;
  }>;
  /** Selecciones de dispositivo que aplican a este certificado, ya ordenadas. */
  deviceSelections: OfflineDeviceSelection[];
  measurements: OfflineMeasurement[];
  verificationRows: OfflineVerificationRow[];
};

export type OfflineSignature = {
  id: string;
  certificateId: string | null; // null = firma general del reporte
  signatureImageUrl: string;
  signedAt: string;
  signerName: string;
  signerTitle: string;
};

export type OfflineReportBundle = {
  version: 1;
  fetchedAt: string; // ISO
  report: OfflineReportMeta;
  standards: OfflineStandard[];
  certificates: OfflineCertificate[];
  signatures: OfflineSignature[];
};

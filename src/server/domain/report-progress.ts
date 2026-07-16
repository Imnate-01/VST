import { CertificateStatus, type CertificateType } from "@prisma/client";

/**
 * Estado de completado del wizard.
 *
 * Un paso está completo cuando ya no hay nada que capturar en él, no cuando el
 * usuario pasó por encima. Para una sección de sensores eso significa firmada:
 * la firma es el acto que cierra la página, y capturar sin firmar deja el
 * certificado sin validar.
 */

export type SectionState =
  /** No hay mediciones capturadas todavía. */
  | "not_started"
  /** Falta captura, o el estado sigue en PENDING. */
  | "pending_capture"
  /** Captura completa y evaluada, pero sin firma activa. */
  | "pending_signature"
  | "signed";

export type CertificateProgressInput = {
  certificateType: CertificateType;
  /** ¿Existe el certificado base en el reporte? */
  exists: boolean;
  measurementCount: number;
  measurementsComplete: boolean;
  overallStatus: CertificateStatus;
  signed: boolean;
};

export type CertificateProgress = CertificateProgressInput & {
  state: SectionState;
  complete: boolean;
};

export type ReportProgressInput = {
  hasDeviceSelections: boolean;
  certificates: CertificateProgressInput[];
  reportSigned: boolean;
};

export type ReportProgress = {
  /** La identidad del reporte (filler + fecha) se fija al crearlo. */
  info: boolean;
  checklist: boolean;
  instruments: boolean;
  certificates: CertificateProgress[];
  review: boolean;
  /** Review deja de estar bloqueado en cuanto hay secciones que revisar. */
  reviewEnabled: boolean;
  signedCount: number;
  totalCount: number;
  pendingCount: number;
  readyToSignReport: boolean;
};

function certificateState(input: CertificateProgressInput): SectionState {
  if (!input.exists || input.measurementCount === 0) return "not_started";
  if (!input.measurementsComplete) return "pending_capture";
  if (input.overallStatus === CertificateStatus.PENDING) return "pending_capture";
  return input.signed ? "signed" : "pending_signature";
}

export function buildReportProgress(input: ReportProgressInput): ReportProgress {
  const certificates = input.certificates.map((certificate): CertificateProgress => {
    const state = certificateState(certificate);
    return { ...certificate, state, complete: state === "signed" };
  });

  const existing = certificates.filter((certificate) => certificate.exists);
  const signedCount = existing.filter((certificate) => certificate.complete).length;
  const totalCount = existing.length;

  return {
    info: true,
    checklist: input.hasDeviceSelections,
    // El paso de instrumentos es el que crea los certificados base, así que su
    // existencia es la evidencia de que se completó.
    instruments: totalCount > 0,
    certificates,
    review: input.reportSigned,
    reviewEnabled: totalCount > 0,
    signedCount,
    totalCount,
    pendingCount: totalCount - signedCount,
    readyToSignReport: totalCount > 0 && signedCount === totalCount,
  };
}

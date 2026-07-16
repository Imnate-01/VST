import { CertificateStatus, CertificateType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  buildReportProgress,
  type CertificateProgressInput,
} from "./report-progress";

function certificate(
  overrides: Partial<CertificateProgressInput> = {}
): CertificateProgressInput {
  return {
    certificateType: CertificateType.TEMPERATURE,
    exists: true,
    measurementCount: 4,
    measurementsComplete: true,
    overallStatus: CertificateStatus.PASS,
    signed: true,
    ...overrides,
  };
}

describe("buildReportProgress", () => {
  it("marca una sección como completa solo cuando está firmada", () => {
    const progress = buildReportProgress({
      hasDeviceSelections: true,
      certificates: [certificate({ signed: false })],
      reportSigned: false,
    });

    expect(progress.certificates[0]!.state).toBe("pending_signature");
    expect(progress.certificates[0]!.complete).toBe(false);
    expect(progress.readyToSignReport).toBe(false);
  });

  it("una sección sin mediciones está sin iniciar", () => {
    const progress = buildReportProgress({
      hasDeviceSelections: true,
      certificates: [certificate({ measurementCount: 0, signed: false })],
      reportSigned: false,
    });

    expect(progress.certificates[0]!.state).toBe("not_started");
  });

  it("una sección con captura incompleta no llega a pending_signature", () => {
    const progress = buildReportProgress({
      hasDeviceSelections: true,
      certificates: [certificate({ measurementsComplete: false, signed: false })],
      reportSigned: false,
    });

    expect(progress.certificates[0]!.state).toBe("pending_capture");
  });

  it("un certificado en PENDING no cuenta como capturado aunque tenga puntos", () => {
    const progress = buildReportProgress({
      hasDeviceSelections: true,
      certificates: [
        certificate({ overallStatus: CertificateStatus.PENDING, signed: false }),
      ],
      reportSigned: false,
    });

    expect(progress.certificates[0]!.state).toBe("pending_capture");
  });

  it("un certificado FAIL firmado está completo: el reporte documenta la desviación", () => {
    const progress = buildReportProgress({
      hasDeviceSelections: true,
      certificates: [certificate({ overallStatus: CertificateStatus.FAIL })],
      reportSigned: false,
    });

    expect(progress.certificates[0]!.state).toBe("signed");
    expect(progress.readyToSignReport).toBe(true);
  });

  it("habilita la firma del reporte cuando todas las secciones están firmadas", () => {
    const progress = buildReportProgress({
      hasDeviceSelections: true,
      certificates: [
        certificate(),
        certificate({ certificateType: CertificateType.PRESSURE }),
      ],
      reportSigned: false,
    });

    expect(progress.signedCount).toBe(2);
    expect(progress.totalCount).toBe(2);
    expect(progress.pendingCount).toBe(0);
    expect(progress.readyToSignReport).toBe(true);
  });

  it("los certificados inexistentes no cuentan para el total", () => {
    const progress = buildReportProgress({
      hasDeviceSelections: true,
      certificates: [
        certificate(),
        certificate({ certificateType: CertificateType.PRESSURE, exists: false }),
      ],
      reportSigned: false,
    });

    expect(progress.totalCount).toBe(1);
    expect(progress.readyToSignReport).toBe(true);
  });

  it("sin certificados no se puede firmar el reporte ni entrar a review", () => {
    const progress = buildReportProgress({
      hasDeviceSelections: false,
      certificates: [],
      reportSigned: false,
    });

    expect(progress.instruments).toBe(false);
    expect(progress.checklist).toBe(false);
    expect(progress.reviewEnabled).toBe(false);
    expect(progress.readyToSignReport).toBe(false);
  });

  it("review queda completo cuando el reporte está firmado", () => {
    const progress = buildReportProgress({
      hasDeviceSelections: true,
      certificates: [certificate()],
      reportSigned: true,
    });

    expect(progress.review).toBe(true);
  });
});

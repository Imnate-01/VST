import { CertificateLayout, CertificateType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  certificateTypesInPdfOrder,
  getCertificateConfig,
  getDefaultTargets,
  implementedCertificateTypes,
} from "./certificates";

describe("registro de certificados", () => {
  it("incluye las trece secciones del PDF de referencia", () => {
    expect(implementedCertificateTypes).toHaveLength(13);
    expect(implementedCertificateTypes).toEqual(
      expect.arrayContaining([
        CertificateType.ULTRASONIC,
        CertificateType.METERING_PUMP_CHAMBER,
        CertificateType.METERING_PUMP_TUNNEL,
        CertificateType.EXHAUST,
      ])
    );
  });

  it("recorre las secciones en el orden de trabajo en sitio", () => {
    // Lista "VST Calibration Procedures and Testing" de los ingenieros. Los
    // pasos de mantenimiento preventivo de esa lista no generan certificado;
    // EOL Flow y VAC Flow no figuran en ella y cierran la captura.
    expect(implementedCertificateTypes).toEqual([
      CertificateType.HUMIDITY,
      CertificateType.TEMPERATURE,
      CertificateType.ULTRASONIC,
      CertificateType.METERING_PUMP_CHAMBER,
      CertificateType.METERING_PUMP_TUNNEL,
      CertificateType.PRESSURE,
      CertificateType.VACUUM_TANK_PRESSURE,
      CertificateType.VACUUM_PRESSURE,
      CertificateType.CHAMBER_VST_AIR_FLOW,
      CertificateType.EXHAUST,
      CertificateType.CHAMBER_STERILE_AIR_FLOW,
      CertificateType.EOL_FLOW,
      CertificateType.VAC_FLOW,
    ]);
  });

  it("imprime en el orden de la plantilla base 2026", () => {
    // El orden impreso no sigue al de captura: el PDF debe seguir siendo
    // comparable contra el molde oficial (VST SF100P_BASE_2026).
    expect(certificateTypesInPdfOrder).toEqual([
      CertificateType.TEMPERATURE,
      CertificateType.CHAMBER_VST_AIR_FLOW,
      CertificateType.CHAMBER_STERILE_AIR_FLOW,
      CertificateType.PRESSURE,
      CertificateType.VACUUM_TANK_PRESSURE,
      CertificateType.VACUUM_PRESSURE,
      CertificateType.EOL_FLOW,
      CertificateType.VAC_FLOW,
      CertificateType.HUMIDITY,
      CertificateType.ULTRASONIC,
      CertificateType.METERING_PUMP_CHAMBER,
      CertificateType.METERING_PUMP_TUNNEL,
      CertificateType.EXHAUST,
    ]);
    expect(certificateTypesInPdfOrder.map((type) => getCertificateConfig(type).pdfPage))
      .toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  });

  it("no repite el orden de captura entre secciones", () => {
    const orders = implementedCertificateTypes.map(
      (type) => getCertificateConfig(type).captureOrder
    );
    expect(new Set(orders).size).toBe(orders.length);
  });

  it("sugiere el par de presión que trae el molde para cada sensor", () => {
    const targets = (description: string) =>
      getDefaultTargets({ certificateType: CertificateType.PRESSURE, description });

    expect(targets("Tank Pressure Sensor - PS")).toEqual({ LOW: "3.0", HIGH: "15.0" });
    expect(targets("Tank N2 Pressure Sensor - PS")).toEqual({ LOW: "3.0", HIGH: "15.0" });
    expect(targets("Chamber Pressure Sensor - PS")).toEqual({ LOW: "10.0", HIGH: "25.0" });
    expect(targets("N2 Supply Pressure Sensor - PS")).toEqual({ LOW: "10.0", HIGH: "20.0" });
  });

  it("crea extracción aunque no provenga del checklist", () => {
    expect(getCertificateConfig(CertificateType.EXHAUST).alwaysRequired).toBe(
      true
    );
  });

  it("muestra desviación en todos los certificados capturados por puntos", () => {
    for (const certificateType of implementedCertificateTypes) {
      const config = getCertificateConfig(certificateType);
      if (
        config.layout === CertificateLayout.RANGE ||
        config.layout === CertificateLayout.SETPOINT ||
        config.layout === CertificateLayout.SINGLE_POINT
      ) {
        expect(config.showDeviation, certificateType).toBe(true);
      }
    }
  });
});

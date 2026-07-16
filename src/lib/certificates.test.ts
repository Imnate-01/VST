import { CertificateType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  getCertificateConfig,
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

  it("crea extracción aunque no provenga del checklist", () => {
    expect(getCertificateConfig(CertificateType.EXHAUST).alwaysRequired).toBe(
      true
    );
  });
});

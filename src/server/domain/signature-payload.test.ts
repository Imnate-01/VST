import { describe, expect, it } from "vitest";
import {
  canonicalizePayload,
  hashSignaturePayload,
  type CertificateSignaturePayload,
} from "./signature-payload";

function certificatePayload(
  overrides: Partial<CertificateSignaturePayload> = {}
): CertificateSignaturePayload {
  return {
    scope: "certificate",
    reportNumber: "CR_Nestle_20260512_CC_Rev2",
    certificateType: "VACUUM_PRESSURE",
    overallStatus: "PASS",
    standardSerial: "4792075",
    notes: null,
    measurements: [
      {
        tagNumber: "1706",
        status: "PASS",
        requiredAdjustment: true,
        correctionMethod: null,
        notes: "Se ajustó el sensor 1706.",
        points: [
          { kind: "LOW", targetNominal: "-5", asFoundReference: "-5", asFoundReading: "-4.8", asLeftReference: "-5", asLeftReading: "-5" },
          { kind: "HIGH", targetNominal: "-25", asFoundReference: "-25", asFoundReading: "-28.8", asLeftReference: "-25", asLeftReading: "-25" },
        ],
      },
      {
        tagNumber: "1702",
        status: "PASS",
        requiredAdjustment: false,
        correctionMethod: null,
        notes: null,
        points: [{ kind: "HIGH", targetNominal: "-25", asFoundReference: "-25", asFoundReading: "-25", asLeftReference: null, asLeftReading: null }],
      },
    ],
    ...overrides,
  };
}

describe("canonicalizePayload", () => {
  it("es estable frente al orden de los measurements", () => {
    const a = certificatePayload();
    const b = certificatePayload({
      measurements: [...certificatePayload().measurements].reverse(),
    });

    expect(canonicalizePayload(a)).toBe(canonicalizePayload(b));
  });

  it("es estable frente al orden de los puntos", () => {
    const base = certificatePayload();
    const swapped = certificatePayload({
      measurements: base.measurements.map((measurement) => ({
        ...measurement,
        points: [...measurement.points].reverse(),
      })),
    });

    expect(canonicalizePayload(base)).toBe(canonicalizePayload(swapped));
  });
});

describe("hashSignaturePayload", () => {
  it("mismo contenido produce el mismo hash", () => {
    expect(hashSignaturePayload(certificatePayload())).toBe(
      hashSignaturePayload(certificatePayload())
    );
  });

  it("cambiar un as-left reading cambia el hash", () => {
    const base = certificatePayload();
    const tampered = certificatePayload({
      measurements: [
        {
          ...base.measurements[0]!,
          points: [
            { kind: "LOW", targetNominal: "-5", asFoundReference: "-5", asFoundReading: "-4.8", asLeftReference: "-5", asLeftReading: "-5" },
            { kind: "HIGH", targetNominal: "-25", asFoundReference: "-25", asFoundReading: "-28.8", asLeftReference: "-25", asLeftReading: "-24" },
          ],
        },
        base.measurements[1]!,
      ],
    });

    expect(hashSignaturePayload(tampered)).not.toBe(hashSignaturePayload(base));
  });

  it("cambiar requiredAdjustment cambia el hash", () => {
    const base = certificatePayload();
    const tampered = certificatePayload({
      measurements: [
        { ...base.measurements[0]!, requiredAdjustment: false },
        base.measurements[1]!,
      ],
    });

    expect(hashSignaturePayload(tampered)).not.toBe(hashSignaturePayload(base));
  });

  it("cambiar las observaciones de un sensor cambia el hash", () => {
    const base = certificatePayload();
    const tampered = certificatePayload({
      measurements: [
        { ...base.measurements[0]!, notes: "Comentario modificado." },
        base.measurements[1]!,
      ],
    });

    expect(hashSignaturePayload(tampered)).not.toBe(hashSignaturePayload(base));
  });

  it("produce un sha256 hexadecimal", () => {
    expect(hashSignaturePayload(certificatePayload())).toMatch(/^[0-9a-f]{64}$/);
  });
});

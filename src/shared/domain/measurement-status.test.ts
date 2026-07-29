import { describe, expect, it } from "vitest";
import { CertificateType } from "@prisma/client";
import {
  aggregateCertificateStatus,
  calculateMeasurementStatus,
  calculateTestReadings,
  testTarget,
} from "@/shared/domain/measurement-status";

describe("calculateMeasurementStatus (isomórfico)", () => {
  const base = {
    certificateType: CertificateType.TEMPERATURE,
    toleranceValue: "1.0",
    toleranceIsPercent: false,
  };

  it("marca PASS cuando el as-left está dentro de tolerancia", () => {
    const result = calculateMeasurementStatus({
      ...base,
      input: {
        deviceSelectionId: "d1",
        points: [
          { kind: "LOW", targetNominal: "40", asFoundReading: "40.2", asLeftReading: "40.1" },
          { kind: "HIGH", targetNominal: "121.5", asFoundReading: "121.4", asLeftReading: "121.5" },
        ],
      },
    });
    expect(result.status).toBe("PASS");
    expect(result.points[0]?.asLeftInTolerance).toBe(true);
  });

  it("marca FAIL cuando el as-left excede la tolerancia", () => {
    const result = calculateMeasurementStatus({
      ...base,
      input: {
        deviceSelectionId: "d1",
        points: [
          { kind: "LOW", targetNominal: "40", asFoundReading: "40", asLeftReading: "42" },
          { kind: "HIGH", targetNominal: "121.5", asFoundReading: "121.5", asLeftReading: "121.5" },
        ],
      },
    });
    expect(result.status).toBe("FAIL");
  });

  it("queda PENDING con captura incompleta", () => {
    const result = calculateMeasurementStatus({
      ...base,
      input: {
        deviceSelectionId: "d1",
        points: [{ kind: "LOW", targetNominal: "40", asFoundReading: "40" }],
      },
    });
    expect(result.status).toBe("PENDING");
  });

  it("firma el dispositivo que solo se calibra en el punto alto", () => {
    // Los RTD de túnel y cámara no tienen punto bajo: declararlo N/A completa
    // la captura en vez de dejar el certificado pendiente para siempre.
    const result = calculateMeasurementStatus({
      ...base,
      input: {
        deviceSelectionId: "d1",
        points: [
          { kind: "LOW", notApplicable: true, targetNominal: "40" },
          {
            kind: "HIGH",
            targetNominal: "121.5",
            asFoundReading: "121.4",
            asLeftReading: "121.5",
          },
        ],
      },
    });

    expect(result.status).toBe("PASS");
    expect(result.points[0]?.notApplicable).toBe(true);
    // El objetivo sugerido no se guarda: nadie midió ese punto.
    expect(result.points[0]?.targetNominal).toBeNull();
    expect(result.points[0]?.asLeftInTolerance).toBeNull();
  });

  it("deja el dispositivo en NA cuando ningún punto aplica", () => {
    const result = calculateMeasurementStatus({
      ...base,
      input: {
        deviceSelectionId: "d1",
        points: [
          { kind: "LOW", notApplicable: true },
          { kind: "HIGH", notApplicable: true },
        ],
      },
    });

    expect(result.status).toBe("NA");
    // NA no es reprobar ni estar pendiente: no cuenta como canal evaluado.
    expect(aggregateCertificateStatus(["NA", "PASS"])).toBe("PASS");
  });

  it("un punto N/A no arrastra al resto a fallar", () => {
    const result = calculateMeasurementStatus({
      ...base,
      input: {
        deviceSelectionId: "d1",
        points: [
          { kind: "LOW", notApplicable: true, asFoundReading: "999" },
          {
            kind: "HIGH",
            targetNominal: "121.5",
            asFoundReading: "123",
            asLeftReading: "121.5",
          },
        ],
      },
    });

    expect(result.status).toBe("PASS");
    expect(result.requiredAdjustment).toBe(true);
  });
});

describe("calculateTestReadings", () => {
  it("PASS cuando todas las corridas caen dentro de tolerancia", () => {
    const target = testTarget(CertificateType.ULTRASONIC, {
      targetWeight: "124",
      material: "x",
    });
    const rows = calculateTestReadings({
      certificateType: CertificateType.ULTRASONIC,
      expectedCount: 2,
      target,
      measurements: [
        {
          deviceSelectionId: "d1",
          readings: [
            { sequence: 1, value: "124.1" },
            { sequence: 2, value: "123.9" },
          ],
          toleranceValue: "2",
          toleranceIsPercent: false,
        },
      ],
    });
    expect(rows[0]?.status).toBe("PASS");
  });
});

describe("aggregateCertificateStatus", () => {
  it("MIXED con pass y fail", () => {
    expect(aggregateCertificateStatus(["PASS", "FAIL"])).toBe("MIXED");
  });
  it("PENDING si hay alguno pendiente", () => {
    expect(aggregateCertificateStatus(["PASS", "PENDING"])).toBe("PENDING");
  });
});

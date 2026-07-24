import { CertificateType, PointKind } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  hasCompleteCertificateMeasurement,
  hasCompleteTestReadings,
  hasCompleteVerificationRows,
} from "./certificate-completeness";

const completePoint = {
  kind: PointKind.LOW,
  targetNominal: "40",
  asFoundReading: "39.8",
  asLeftReading: "40",
};

describe("hasCompleteCertificateMeasurement", () => {
  it("requiere todos los puntos configurados del certificado", () => {
    expect(
      hasCompleteCertificateMeasurement(CertificateType.TEMPERATURE, [
        completePoint,
      ])
    ).toBe(false);

    expect(
      hasCompleteCertificateMeasurement(CertificateType.TEMPERATURE, [
        completePoint,
        { ...completePoint, kind: PointKind.HIGH, targetNominal: "121.5" },
      ])
    ).toBe(true);
  });

  it("permite guardar pero no firmar si falta un campo de medición", () => {
    expect(
      hasCompleteCertificateMeasurement(CertificateType.HUMIDITY, [
        {
          ...completePoint,
          kind: PointKind.SINGLE,
          asLeftReading: "",
        },
      ])
    ).toBe(false);
  });

  it("requiere la condición de ensayo en certificados SETPOINT", () => {
    const lowPoint = { ...completePoint, conditionValue: "25" };
    const highPoint = {
      ...completePoint,
      kind: PointKind.HIGH,
      conditionValue: "75",
    };
    const points = [
      lowPoint,
      highPoint,
    ];

    expect(
      hasCompleteCertificateMeasurement(
        CertificateType.CHAMBER_VST_AIR_FLOW,
        points
      )
    ).toBe(true);
    expect(
      hasCompleteCertificateMeasurement(
        CertificateType.CHAMBER_VST_AIR_FLOW,
        [{ ...lowPoint, conditionValue: "" }, highPoint]
      )
    ).toBe(false);
  });
});

describe("hasCompleteTestReadings", () => {
  it("requiere objetivo y las dos corridas de la plantilla", () => {
    expect(
      hasCompleteTestReadings(2, [
        { target: "37.5", value: "38" },
        { target: "37.5", value: "39" },
      ])
    ).toBe(true);
    expect(
      hasCompleteTestReadings(2, [
        { target: "37.5", value: "38" },
        { target: "37.5", value: "" },
      ])
    ).toBe(false);
  });
});

describe("hasCompleteVerificationRows", () => {
  it("permite N/A solo para la frecuencia del variador", () => {
    expect(
      hasCompleteVerificationRows([
        { scfm: "205", driveFrequencyHz: null, notApplicable: true },
      ])
    ).toBe(true);
    expect(
      hasCompleteVerificationRows([
        { scfm: "", driveFrequencyHz: null, notApplicable: true },
      ])
    ).toBe(false);
    expect(
      hasCompleteVerificationRows([
        { scfm: "205", driveFrequencyHz: "", notApplicable: false },
      ])
    ).toBe(false);
  });
});

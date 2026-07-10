import { describe, it, expect } from "vitest";
import {
  IndeterminateToleranceError,
  aggregateCertificateStatus,
  evaluatePoint,
  evaluatePointSet,
  evaluateTestReadings,
  resolveToleranceAbsolute,
  type PointInput,
} from "./calibration";
import { Decimal } from "decimal.js";

type PointSet = { low?: PointInput; high?: PointInput };

/** Azúcar para los tests: arma un point set low/high a partir de un objeto. */
function evaluateMeasurement(input: PointSet) {
  const entries = (["low", "high"] as const)
    .filter((kind) => input[kind])
    .map((kind) => ({ kind, input: input[kind]! }));

  const result = evaluatePointSet(entries);
  const byKind = new Map(result.points.map((point) => [point.kind, point.result]));

  return {
    low: byKind.get("low") ?? null,
    high: byKind.get("high") ?? null,
    overall: result.overall,
    requiredAdjustment: result.requiredAdjustment,
  };
}

/**
 * Casos basados en el reporte real:
 * CR_Nestle_20260512_CC_Rev2 - SureFill 100 serial 652
 *
 * Modelo de tres valores: deviation = reading - reference. En el reporte real
 * la reference del patrón coincide con el target nominal, así que se usa el
 * mismo número para ambos.
 *
 * Ese reporte fue emitido, firmado y aceptado. Cualquier cambio que lo haga
 * reprobar es un bug del motor, no un hallazgo de calibración.
 */

describe("evaluatePoint - as found dentro de tolerancia (sin ajuste)", () => {
  // PDF p.3, Temperature tag 1573 (Vaporizer), tolerancia ± 1.0 °C
  it("1573 low: reference 40, reading 39.4 -> pass sin ajuste", () => {
    const result = evaluatePoint({
      asFound: { reference: 40, reading: 39.4 },
      toleranceValue: 1.0,
      toleranceIsPercent: false,
    });

    expect(result.asFound?.deviation.toNumber()).toBeCloseTo(-0.6);
    expect(result.asFound?.toleranceAbsolute.toNumber()).toBe(1.0);
    expect(result.asFound?.inTolerance).toBe(true);
    expect(result.requiredAdjustment).toBe(false);
    expect(result.status).toBe("pass");
  });

  // Ejemplo de la plantilla thermocouple: target 72, actual reference 72,
  // UUT reading 71.1 -> deviation -0.9, dentro de ± 1.0 -> Pass.
  it("thermocouple 72.0: reading 71.1 -> deviation -0.9, pass", () => {
    const result = evaluatePoint({
      targetNominal: 72.0,
      asFound: { reference: 72.0, reading: 71.1 },
      asLeft: { reference: 72.0, reading: 71.1 },
      toleranceValue: 1.0,
      toleranceIsPercent: false,
    });

    expect(result.asFound?.deviation.toNumber()).toBeCloseTo(-0.9);
    expect(result.asLeft?.deviation.toNumber()).toBeCloseTo(-0.9);
    expect(result.status).toBe("pass");
    expect(result.requiredAdjustment).toBe(false);
  });

  // deviation se calcula contra la reference, NO contra el target nominal.
  it("reference distinta del target nominal: deviation usa la reference", () => {
    const result = evaluatePoint({
      targetNominal: 72.0,
      asFound: { reference: 72.3, reading: 71.1 },
      toleranceValue: 1.0,
      toleranceIsPercent: false,
    });

    // 71.1 - 72.3 = -1.2, fuera de ± 1.0 (contra target daría -0.9, dentro).
    expect(result.asFound?.deviation.toNumber()).toBeCloseTo(-1.2);
    expect(result.asFound?.inTolerance).toBe(false);
  });

  it("desviación exactamente igual a la tolerancia: pass", () => {
    const result = evaluatePoint({
      asFound: { reference: 100, reading: 101 },
      toleranceValue: 1.0,
      toleranceIsPercent: false,
    });

    expect(result.asFound?.deviation.toNumber()).toBe(1);
    expect(result.status).toBe("pass");
  });

  it("desviación apenas fuera de tolerancia, sin as-left: fail", () => {
    const result = evaluatePoint({
      asFound: { reference: 100, reading: 101.01 },
      toleranceValue: 1.0,
      toleranceIsPercent: false,
    });

    expect(result.asFound?.deviation.toNumber()).toBeCloseTo(1.01);
    expect(result.requiredAdjustment).toBe(true);
    expect(result.status).toBe("fail");
  });
});

describe("evaluatePoint - as found fuera de tolerancia, as left dentro", () => {
  // PDF p.15, Vacuum tag 1706 (Station 3), tolerancia ± 0.10 % Hg.
  // as found reading -28.8 (deriva grande), as left reading -25.0. El reporte pasa.
  it("1706 high: as found -28.8 fuera, as left -25.0 dentro -> pass con ajuste", () => {
    const result = evaluatePoint({
      asFound: { reference: -25.0, reading: -28.8 },
      asLeft: { reference: -25.0, reading: -25.0 },
      toleranceValue: 0.1,
      toleranceIsPercent: true,
    });

    expect(result.asFound?.toleranceAbsolute.toNumber()).toBeCloseTo(0.025);
    expect(result.asFound?.deviation.toNumber()).toBeCloseTo(-3.8);
    expect(result.asFound?.inTolerance).toBe(false);
    expect(result.asLeft?.deviation.toNumber()).toBe(0);
    expect(result.asLeft?.inTolerance).toBe(true);
    expect(result.requiredAdjustment).toBe(true);
    expect(result.status).toBe("pass");
  });

  // El mismo punto sin registrar el as-left decide sobre el as-found -> fail.
  it("1706 high sin as-left: fail", () => {
    const result = evaluatePoint({
      asFound: { reference: -25.0, reading: -28.8 },
      toleranceValue: 0.1,
      toleranceIsPercent: true,
    });

    expect(result.asLeft).toBeNull();
    expect(result.status).toBe("fail");
  });

  it("as-left también fuera de tolerancia: fail aunque se haya ajustado", () => {
    const result = evaluatePoint({
      asFound: { reference: -25.0, reading: -28.8 },
      asLeft: { reference: -25.0, reading: -26.0 },
      toleranceValue: 0.1,
      toleranceIsPercent: true,
    });

    expect(result.asLeft?.deviation.toNumber()).toBeCloseTo(-1.0);
    expect(result.asLeft?.inTolerance).toBe(false);
    expect(result.requiredAdjustment).toBe(true);
    expect(result.status).toBe("fail");
  });

  // PDF p.15, Vacuum tag 1702 (Station 1): as found exacto, no requiere ajuste.
  it("1702 high: as found -25.0 exacto -> pass sin ajuste", () => {
    const result = evaluatePoint({
      asFound: { reference: -25.0, reading: -25.0 },
      toleranceValue: 0.1,
      toleranceIsPercent: true,
    });

    expect(result.asFound?.deviation.toNumber()).toBe(0);
    expect(result.requiredAdjustment).toBe(false);
    expect(result.status).toBe("pass");
  });

  it("un pase con reference pero sin reading se trata como no capturado", () => {
    const result = evaluatePoint({
      asFound: { reference: 40, reading: 39.4 },
      asLeft: { reference: 40, reading: "" },
      toleranceValue: 1.0,
      toleranceIsPercent: false,
    });

    expect(result.asLeft).toBeNull();
    expect(result.status).toBe("pass");
  });
});

describe("resolveToleranceAbsolute", () => {
  it("tolerancia absoluta se usa tal cual, en valor absoluto", () => {
    const tolerance = resolveToleranceAbsolute(
      new Decimal(-25),
      new Decimal(-0.5),
      false
    );
    expect(tolerance.toNumber()).toBe(0.5);
  });

  it("tolerancia porcentual usa |reference|", () => {
    const tolerance = resolveToleranceAbsolute(new Decimal(-100), new Decimal(2), true);
    expect(tolerance.toNumber()).toBe(2);
  });

  it("tolerancia porcentual con reference 0 lanza IndeterminateToleranceError", () => {
    expect(() => resolveToleranceAbsolute(new Decimal(0), new Decimal(5), true)).toThrow(
      IndeterminateToleranceError
    );
  });

  it("tolerancia absoluta con reference 0 es válida", () => {
    const tolerance = resolveToleranceAbsolute(new Decimal(0), new Decimal(0.5), false);
    expect(tolerance.toNumber()).toBe(0.5);
  });
});

describe("evaluateMeasurement (point set)", () => {
  it("ambos puntos pass: overall pass, sin ajuste", () => {
    const result = evaluateMeasurement({
      low: {
        asFound: { reference: 40, reading: 39.4 },
        toleranceValue: 1.0,
        toleranceIsPercent: false,
      },
      high: {
        asFound: { reference: 121.5, reading: 120.8 },
        toleranceValue: 1.0,
        toleranceIsPercent: false,
      },
    });

    expect(result.overall).toBe("pass");
    expect(result.requiredAdjustment).toBe(false);
    expect(result.low?.status).toBe("pass");
    expect(result.high?.status).toBe("pass");
  });

  // PDF p.15, tag 1706 completo: low dentro, high fuera pero corregido.
  it("1706 completo: overall pass y requiredAdjustment true", () => {
    const result = evaluateMeasurement({
      low: {
        asFound: { reference: -5.0, reading: -4.8 },
        asLeft: { reference: -5.0, reading: -5.0 },
        toleranceValue: 0.1,
        toleranceIsPercent: true,
      },
      high: {
        asFound: { reference: -25.0, reading: -28.8 },
        asLeft: { reference: -25.0, reading: -25.0 },
        toleranceValue: 0.1,
        toleranceIsPercent: true,
      },
    });

    expect(result.overall).toBe("pass");
    expect(result.requiredAdjustment).toBe(true);
  });

  it("un punto fail: overall fail", () => {
    const result = evaluateMeasurement({
      low: {
        asFound: { reference: 40, reading: 39.4 },
        toleranceValue: 1.0,
        toleranceIsPercent: false,
      },
      high: {
        asFound: { reference: 121.5, reading: 115.0 },
        toleranceValue: 1.0,
        toleranceIsPercent: false,
      },
    });

    expect(result.overall).toBe("fail");
    expect(result.requiredAdjustment).toBe(true);
  });

  it("sin puntos: overall na", () => {
    const result = evaluateMeasurement({});
    expect(result.overall).toBe("na");
    expect(result.low).toBeNull();
    expect(result.high).toBeNull();
  });

  it("solo punto bajo capturado y pass: overall pass", () => {
    const result = evaluateMeasurement({
      low: {
        asFound: { reference: 40, reading: 39.5 },
        toleranceValue: 1.0,
        toleranceIsPercent: false,
      },
    });

    expect(result.overall).toBe("pass");
    expect(result.high).toBeNull();
  });

  it("punto sin ningún pase capturado no cuenta: overall na", () => {
    const result = evaluatePointSet([
      {
        kind: "LOW" as const,
        input: { toleranceValue: 1.0, toleranceIsPercent: false },
      },
    ]);

    expect(result.overall).toBe("na");
  });
});

describe("evaluateTestReadings", () => {
  // PDF p.12, Metering Pump Chamber: metering rate 7.5 x 5 min = 37.5 g de target.
  // Tags 1403 y 1411 leen 38.0 g. Tolerancia ± 10 % g -> 3.75 g.
  it("Metering Pump Chamber: ambas lecturas dentro del ±10%", () => {
    const result = evaluateTestReadings({
      target: 37.5,
      readings: [38.0, 38.0],
      toleranceValue: 10,
      toleranceIsPercent: true,
    });

    expect(result.toleranceAbsolute.toNumber()).toBeCloseTo(3.75);
    expect(result.readings[0]?.deviation?.toNumber()).toBeCloseTo(0.5);
    expect(result.readings.every((reading) => reading.inTolerance)).toBe(true);
    expect(result.overall).toBe("pass");
  });

  it("una lectura fuera de tolerancia: overall fail", () => {
    const result = evaluateTestReadings({
      target: 100,
      readings: [101.0, 115.0],
      toleranceValue: 10,
      toleranceIsPercent: true,
    });

    expect(result.readings[1]?.inTolerance).toBe(false);
    expect(result.overall).toBe("fail");
  });

  it("lecturas vacías se ignoran y permiten captura parcial", () => {
    const result = evaluateTestReadings({
      target: 100,
      readings: [101.0, null],
      toleranceValue: 10,
      toleranceIsPercent: true,
    });

    expect(result.readings[1]).toEqual({
      sequence: 2,
      value: null,
      deviation: null,
      inTolerance: null,
    });
    expect(result.overall).toBe("pass");
  });

  it("sin ninguna lectura: overall na", () => {
    const result = evaluateTestReadings({
      target: 100,
      readings: [null, undefined],
      toleranceValue: 10,
      toleranceIsPercent: true,
    });

    expect(result.overall).toBe("na");
  });
});

describe("evaluatePointSet", () => {
  it("respeta las claves de punto que recibe", () => {
    const result = evaluatePointSet([
      {
        kind: "SINGLE" as const,
        input: {
          asFound: { reference: 10.0, reading: 9.8 },
          toleranceValue: 2,
          toleranceIsPercent: true,
        },
      },
    ]);

    expect(result.points).toHaveLength(1);
    expect(result.points[0]?.kind).toBe("SINGLE");
    expect(result.overall).toBe("pass");
  });

  it("sin puntos: overall na", () => {
    expect(evaluatePointSet([]).overall).toBe("na");
  });
});

describe("aggregateCertificateStatus", () => {
  it("todos pass: pass", () => {
    expect(aggregateCertificateStatus(["pass", "pass", "pass"])).toBe("pass");
  });

  it("todos fail: fail", () => {
    expect(aggregateCertificateStatus(["fail", "fail"])).toBe("fail");
  });

  it("mezcla: mixed", () => {
    expect(aggregateCertificateStatus(["pass", "fail", "pass"])).toBe("mixed");
  });

  it("con NAs ignorados: pass", () => {
    expect(aggregateCertificateStatus(["pass", "na", "pass"])).toBe("pass");
  });

  it("con pending: pending", () => {
    expect(aggregateCertificateStatus(["pass", "pending"])).toBe("pending");
  });

  it("todos NA: pending (nada aplicado)", () => {
    expect(aggregateCertificateStatus(["na", "na"])).toBe("pending");
  });

  it("vacío: pending", () => {
    expect(aggregateCertificateStatus([])).toBe("pending");
  });
});

describe("precisión numérica", () => {
  it("no sufre errores de float", () => {
    const result = evaluatePoint({
      asFound: { reference: "0.1", reading: "0.3" },
      toleranceValue: "0.2",
      toleranceIsPercent: false,
    });

    expect(result.asFound?.deviation.toString()).toBe("0.2");
    expect(result.status).toBe("pass");
  });

  it("acepta strings, numbers y Decimal indistintamente", () => {
    const result = evaluatePoint({
      asFound: { reference: new Decimal("121.5"), reading: "120.8" },
      asLeft: { reference: 121.5, reading: 121.5 },
      toleranceValue: 1,
      toleranceIsPercent: false,
    });

    expect(result.asLeft?.deviation.toNumber()).toBe(0);
    expect(result.status).toBe("pass");
  });
});

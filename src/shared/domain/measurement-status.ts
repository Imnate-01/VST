/**
 * Motor de estado de medición — PURO e ISOMÓRFICO.
 *
 * Vive fuera de `@/server` a propósito: lo consumen tanto el servicio de
 * certificados (que además escribe en Prisma) como el repositorio offline en el
 * navegador. Así el Pass/Fail, las desviaciones y el estado agregado que se
 * calculan sin conexión son byte a byte los mismos que recalcula el servidor al
 * sincronizar.
 *
 * No importa Prisma runtime ni Next: solo decimal.js, los enums de @prisma/client
 * (objetos planos, seguros en cliente en este proyecto) y el motor de dominio
 * puro de calibración.
 */
import {
  CertificateStatus,
  CertificateType,
  MeasurementStatus,
  PointKind,
} from "@prisma/client";
import { Decimal } from "decimal.js";
import {
  IndeterminateToleranceError,
  aggregateCertificateStatus as aggregateOverallStatus,
  evaluatePointSet,
  evaluateTestReadings,
  type MeasurementOverall,
} from "@/server/domain/calibration";
import {
  hasCompleteCertificateMeasurement,
  hasCompleteTestReadings,
} from "@/server/domain/certificate-completeness";
import { getCertificateConfig } from "@/lib/certificates";
import type {
  CertificateMeasurementRowInput,
  MeasurementPointInput,
  UpsertTestReadingsInput,
} from "@/lib/validations/measurements";

// ============ Utilidades decimales ============

export function toDecimalOrNull(value: string | undefined): Decimal | null {
  return value ? new Decimal(value) : null;
}

export function decimalToStringOrNull(value: Decimal | null): string | null {
  return value ? value.toString() : null;
}

// ============ Layout de puntos (RANGE / SETPOINT / SINGLE_POINT) ============

export type CalculatedPoint = {
  kind: PointKind;
  notApplicable: boolean;
  conditionValue: Decimal | null;
  targetNominal: Decimal | null;
  asFoundReference: Decimal | null;
  asFoundReading: Decimal | null;
  asFoundDeviation: Decimal | null;
  asFoundInTolerance: boolean | null;
  asLeftReference: Decimal | null;
  asLeftReading: Decimal | null;
  asLeftDeviation: Decimal | null;
  asLeftInTolerance: boolean | null;
};

export type CalculatedMeasurement = {
  points: CalculatedPoint[];
  status: MeasurementStatus;
  statusReason: string | null;
  requiredAdjustment: boolean;
};

function rawPoint(input: MeasurementPointInput): CalculatedPoint {
  // Un punto que no aplica se guarda vacío aunque el formulario traiga un
  // objetivo por defecto: dejar el número sugerido haría creer que se midió.
  if (input.notApplicable) {
    return {
      kind: input.kind,
      notApplicable: true,
      conditionValue: null,
      targetNominal: null,
      asFoundReference: null,
      asFoundReading: null,
      asFoundDeviation: null,
      asFoundInTolerance: null,
      asLeftReference: null,
      asLeftReading: null,
      asLeftDeviation: null,
      asLeftInTolerance: null,
    };
  }

  const targetNominal = toDecimalOrNull(input.targetNominal);
  return {
    kind: input.kind,
    notApplicable: false,
    conditionValue: toDecimalOrNull(input.conditionValue),
    targetNominal,
    // Las columnas se conservan para compatibilidad histórica. Desde ahora el
    // objetivo nominal es la referencia de ambos pases.
    asFoundReference: targetNominal,
    asFoundReading: toDecimalOrNull(input.asFoundReading),
    asFoundDeviation: null,
    asFoundInTolerance: null,
    asLeftReference: targetNominal,
    asLeftReading: toDecimalOrNull(input.asLeftReading),
    asLeftDeviation: null,
    asLeftInTolerance: null,
  };
}

function pendingMeasurement(
  points: CalculatedPoint[],
  statusReason: string
): CalculatedMeasurement {
  return {
    points,
    status: MeasurementStatus.PENDING,
    statusReason,
    requiredAdjustment: false,
  };
}

/** Un pase está completo con reference + reading, y parcial con solo uno. */
function passState(reference: Decimal | null, reading: Decimal | null) {
  return {
    complete: Boolean(reference && reading),
    partial: Boolean(reference) !== Boolean(reading),
  };
}

/**
 * Calcula el estado de un dispositivo a partir de sus puntos.
 *
 * El Pass/Fail se decide sobre el pase As Left cuando fue capturado. Un As Found
 * fuera de tolerancia no reprueba: significa que el instrumento derivó y hubo
 * que ajustarlo. deviation = reading - reference. Ver el motor de dominio.
 */
export function calculateMeasurementStatus(params: {
  certificateType: CertificateType;
  input: CertificateMeasurementRowInput;
  toleranceValue: Decimal | string;
  toleranceIsPercent: boolean;
}): CalculatedMeasurement {
  const rawPoints = params.input.points.map(rawPoint);
  // Los puntos declarados N/A quedan fuera de todo el cálculo: no se completan,
  // no se evalúan y no aportan al Pass/Fail.
  const applicablePoints = rawPoints.filter((point) => !point.notApplicable);

  if (applicablePoints.length === 0) {
    return {
      points: rawPoints,
      status: MeasurementStatus.NA,
      statusReason: "Todos los puntos del dispositivo están marcados como N/A",
      requiredAdjustment: false,
    };
  }

  if (
    !hasCompleteCertificateMeasurement(
      params.certificateType,
      params.input.points
    )
  ) {
    return pendingMeasurement(
      rawPoints,
      "Completa todos los puntos y campos de medición antes de firmar"
    );
  }

  const passes = applicablePoints.map((point) => ({
    found: passState(point.asFoundReference, point.asFoundReading),
    left: passState(point.asLeftReference, point.asLeftReading),
  }));

  const anyComplete = passes.some((p) => p.found.complete || p.left.complete);
  const anyPartial = passes.some((p) => p.found.partial || p.left.partial);

  if (!anyComplete && !anyPartial) {
    return pendingMeasurement(rawPoints, "Sin mediciones capturadas");
  }

  if (anyPartial) {
    return pendingMeasurement(
      rawPoints,
      "En algún pase falta el objetivo nominal o la lectura del UUT"
    );
  }

  const toleranceValue = params.toleranceValue.toString();

  let evaluated;
  try {
    evaluated = evaluatePointSet(
      applicablePoints.map((point) => ({
        kind: point.kind,
        input: {
          targetNominal: point.targetNominal,
          asFound:
            point.asFoundReference && point.asFoundReading
              ? {
                  reference: point.asFoundReference,
                  reading: point.asFoundReading,
                }
              : null,
          asLeft:
            point.asLeftReference && point.asLeftReading
              ? {
                  reference: point.asLeftReference,
                  reading: point.asLeftReading,
                }
              : null,
          toleranceValue,
          toleranceIsPercent: params.toleranceIsPercent,
        },
      }))
    );
  } catch (error) {
    if (error instanceof IndeterminateToleranceError) {
      return pendingMeasurement(rawPoints, error.message);
    }
    throw error;
  }

  const resultByKind = new Map(
    evaluated.points.map((point) => [point.kind, point.result])
  );

  const points: CalculatedPoint[] = rawPoints.map((point) => {
    const result = point.notApplicable ? null : resultByKind.get(point.kind);
    if (!result) return point;

    return {
      ...point,
      asFoundDeviation: result.asFound?.deviation ?? null,
      asFoundInTolerance: result.asFound?.inTolerance ?? null,
      asLeftDeviation: result.asLeft?.deviation ?? null,
      asLeftInTolerance: result.asLeft?.inTolerance ?? null,
    };
  });

  const failed = evaluated.overall === "fail";

  return {
    points,
    status: failed ? MeasurementStatus.FAIL : MeasurementStatus.PASS,
    statusReason: buildStatusReason({
      failed,
      requiredAdjustment: evaluated.requiredAdjustment,
    }),
    requiredAdjustment: evaluated.requiredAdjustment,
  };
}

function buildStatusReason(params: {
  failed: boolean;
  requiredAdjustment: boolean;
}): string | null {
  if (params.failed) {
    return params.requiredAdjustment
      ? "As found fuera de tolerancia y el As Left sigue fuera de tolerancia"
      : "As Left fuera de tolerancia";
  }

  return params.requiredAdjustment
    ? "As Found fuera de tolerancia; ajustado y verificado dentro de tolerancia"
    : null;
}

// ============ Agregación de estado de certificado ============

const MEASUREMENT_TO_OVERALL: Record<
  MeasurementStatus,
  MeasurementOverall | "pending"
> = {
  [MeasurementStatus.PENDING]: "pending",
  [MeasurementStatus.PASS]: "pass",
  [MeasurementStatus.FAIL]: "fail",
  [MeasurementStatus.NA]: "na",
};

const OVERALL_TO_CERTIFICATE: Record<
  ReturnType<typeof aggregateOverallStatus>,
  CertificateStatus
> = {
  pending: CertificateStatus.PENDING,
  pass: CertificateStatus.PASS,
  fail: CertificateStatus.FAIL,
  mixed: CertificateStatus.MIXED,
};

export function aggregateCertificateStatus(
  statuses: MeasurementStatus[]
): CertificateStatus {
  const overall = aggregateOverallStatus(
    statuses.map((status) => MEASUREMENT_TO_OVERALL[status])
  );

  return OVERALL_TO_CERTIFICATE[overall];
}

// ============ Layout TEST_READINGS (Ultrasonic, Metering Pump) ============

export type StoredTestParams = {
  meteringRate?: string;
  durationMinutes?: string;
  targetWeight?: string;
  material: string;
};

export function normalizeTestParams(
  input: UpsertTestReadingsInput["params"]
): StoredTestParams {
  return {
    ...(input.meteringRate ? { meteringRate: input.meteringRate } : {}),
    ...(input.durationMinutes ? { durationMinutes: input.durationMinutes } : {}),
    ...(input.targetWeight ? { targetWeight: input.targetWeight } : {}),
    material: input.material?.trim() || "Minimum 34% Hydrogen Peroxide",
  };
}

export function testTarget(
  certificateType: CertificateType,
  params: StoredTestParams
): Decimal | null {
  if (certificateType === CertificateType.ULTRASONIC) {
    if (!params.targetWeight) return null;
    const target = new Decimal(params.targetWeight);
    return target.gt(0) ? target : null;
  }

  if (!params.meteringRate || !params.durationMinutes) return null;
  const target = new Decimal(params.meteringRate).times(params.durationMinutes);
  return target.gt(0) ? target : null;
}

export type TestReadingsMeasurementInput = {
  deviceSelectionId: string;
  notes?: string;
  readings: Array<{ sequence: number; value?: string }>;
  toleranceValue: string;
  toleranceIsPercent: boolean;
};

export type CalculatedTestReadingRow = {
  deviceSelectionId: string;
  notes: string | null;
  status: MeasurementStatus;
  statusReason: string | null;
  readings: Array<{
    sequence: number;
    value: string | null;
    target: string | null;
    deviation: string | null;
    inTolerance: boolean | null;
  }>;
};

/**
 * Calcula el estado de cada dispositivo en un certificado TEST_READINGS.
 * Lanza si el número de corridas no coincide con lo esperado (invariante que
 * comparten cliente y servidor). El caller aporta el objetivo y las tolerancias
 * (que en el servidor provienen del snapshot de la selección).
 */
export function calculateTestReadings(params: {
  certificateType: CertificateType;
  expectedCount: number;
  target: Decimal | null;
  measurements: TestReadingsMeasurementInput[];
}): CalculatedTestReadingRow[] {
  const config = getCertificateConfig(params.certificateType);

  return params.measurements.map((measurementInput) => {
    const readings = [...measurementInput.readings].sort(
      (a, b) => a.sequence - b.sequence
    );
    const expectedSequences = Array.from(
      { length: params.expectedCount },
      (_, index) => index + 1
    );
    if (
      readings.length !== params.expectedCount ||
      readings.some(
        (reading, index) => reading.sequence !== expectedSequences[index]
      )
    ) {
      throw new Error(
        `El certificado ${config.label} requiere ${params.expectedCount} corridas.`
      );
    }

    const evaluated = params.target
      ? evaluateTestReadings({
          target: params.target,
          readings: readings.map((reading) => reading.value),
          toleranceValue: measurementInput.toleranceValue,
          toleranceIsPercent: measurementInput.toleranceIsPercent,
        })
      : null;
    const complete = hasCompleteTestReadings(
      params.expectedCount,
      readings.map((reading) => ({
        value: reading.value,
        target: params.target?.toString(),
      }))
    );
    const failed = complete && evaluated?.overall === "fail";

    return {
      deviceSelectionId: measurementInput.deviceSelectionId,
      notes: measurementInput.notes?.trim() || null,
      status: !complete
        ? MeasurementStatus.PENDING
        : failed
          ? MeasurementStatus.FAIL
          : MeasurementStatus.PASS,
      statusReason: !params.target
        ? "Falta el objetivo de la prueba"
        : !complete
          ? "Completa todas las corridas antes de firmar"
          : failed
            ? "Una o más corridas están fuera de tolerancia"
            : null,
      readings: readings.map((reading, index) => ({
        sequence: reading.sequence,
        value: reading.value || null,
        target: params.target?.toString() ?? null,
        deviation: evaluated?.readings[index]?.deviation?.toString() ?? null,
        inTolerance: evaluated?.readings[index]?.inTolerance ?? null,
      })),
    };
  });
}

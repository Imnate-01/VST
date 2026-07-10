import { Decimal } from "decimal.js";

/**
 * Motor de dominio para calibración.
 * Funciones puras, sin dependencias de Prisma ni Next.js.
 * Todas las operaciones usan Decimal para evitar errores de float.
 *
 * Modelo de tres valores (práctica estándar de metrología):
 *
 *   - "target" es el setpoint nominal que se apunta (informativo, no entra al
 *     cálculo).
 *   - "reference" es lo que el patrón trazable (RTD + calibrador, gauge patrón,
 *     etc.) REALMENTE lee. Es la verdad contra la que se compara.
 *   - "reading" es lo que lee el instrumento bajo prueba (UUT).
 *   - deviation = reading - reference. La comparación es contra el patrón, no
 *     contra el nominal: por eso existe un patrón de referencia trazable.
 *
 * Cada punto se mide dos veces:
 *   - As Found: antes de ajustar. Documenta la deriva.
 *   - As Left: después de ajustar. Decide el Pass/Fail final.
 * Ambos pases tienen su propia reference y reading, porque son mediciones
 * físicas distintas tomadas en momentos distintos.
 *
 * Ejemplo del reporte CR_Nestle_20260512_CC_Rev2, tag 1706 (Station 3 Vacuum):
 * reference -25.0, as found reading -28.8 (fuera de tolerancia), as left
 * reading -25.0 (dentro). El reporte fue emitido y firmado como válido.
 */

export type DecimalLike = Decimal | string | number;

/**
 * Se lanza cuando la tolerancia no puede resolverse a un valor absoluto.
 * Hoy solo ocurre con tolerancia porcentual sobre un target de cero: la
 * tolerancia absoluta daría 0 y ninguna lectura podría pasar jamás.
 *
 * El caller decide qué hacer (típicamente marcar el measurement como PENDING
 * y pedirle al usuario un target válido) en vez de reprobar en silencio.
 */
export class IndeterminateToleranceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndeterminateToleranceError";
  }
}

/** Un pase de medición: lo que leyó el patrón y lo que leyó el UUT. */
export type PassInput = {
  reference: DecimalLike;
  reading: DecimalLike;
};

export type PointInput = {
  /** Setpoint nominal. Informativo; no entra al Pass/Fail. */
  targetNominal?: DecimalLike | null;
  asFound?: PassInput | null;
  asLeft?: PassInput | null;
  toleranceValue: DecimalLike;
  toleranceIsPercent: boolean;
};

export type PassResult = {
  reference: Decimal;
  reading: Decimal;
  deviation: Decimal;
  toleranceAbsolute: Decimal;
  inTolerance: boolean;
};

export type PointResult = {
  /** null cuando el pase no fue capturado (falta reference o reading). */
  asFound: PassResult | null;
  asLeft: PassResult | null;

  /** El as-found estaba fuera de tolerancia y hubo que ajustar. */
  requiredAdjustment: boolean;

  /** as-left si fue capturado; si no, as-found. */
  status: "pass" | "fail";
};

/**
 * Convierte la tolerancia declarada del dispositivo a un valor absoluto
 * comparable contra la desviación.
 *
 * NOTA ABIERTA: para tolerancias porcentuales el reporte no especifica
 * porcentaje "de la lectura" vs "del fondo de escala". Acá se asume
 * porcentaje del valor de referencia, que es la lectura verdadera.
 */
export function resolveToleranceAbsolute(
  base: Decimal,
  toleranceValue: Decimal,
  toleranceIsPercent: boolean
): Decimal {
  if (!toleranceIsPercent) return toleranceValue.abs();

  if (base.isZero()) {
    throw new IndeterminateToleranceError(
      "Tolerancia porcentual sobre una referencia de 0: la tolerancia absoluta sería 0 y ninguna lectura podría pasar."
    );
  }

  return base.abs().mul(toleranceValue.abs()).div(100);
}

function hasValue(value: DecimalLike | null | undefined): value is DecimalLike {
  return value !== null && value !== undefined && value !== "";
}

function evaluatePass(
  pass: PassInput | null | undefined,
  toleranceValue: DecimalLike,
  toleranceIsPercent: boolean
): PassResult | null {
  if (!pass || !hasValue(pass.reference) || !hasValue(pass.reading)) return null;

  const reference = new Decimal(pass.reference);
  const reading = new Decimal(pass.reading);
  const toleranceAbsolute = resolveToleranceAbsolute(
    reference,
    new Decimal(toleranceValue),
    toleranceIsPercent
  );
  const deviation = reading.minus(reference);

  return {
    reference,
    reading,
    deviation,
    toleranceAbsolute,
    inTolerance: deviation.abs().lte(toleranceAbsolute),
  };
}

/**
 * Evalúa un punto de calibración con sus pases As Found y As Left.
 *
 * Cada pase: deviation = reading - reference.
 * toleranceAbsolute = toleranceIsPercent ? |reference| * tol / 100 : |tol|
 * inTolerance = |deviation| <= toleranceAbsolute
 *
 * El status se decide sobre el as-left cuando fue capturado.
 */
export function evaluatePoint(input: PointInput): PointResult {
  const asFound = evaluatePass(input.asFound, input.toleranceValue, input.toleranceIsPercent);
  const asLeft = evaluatePass(input.asLeft, input.toleranceValue, input.toleranceIsPercent);

  const decider = asLeft ?? asFound;

  return {
    asFound,
    asLeft,
    requiredAdjustment: asFound ? !asFound.inTolerance : false,
    status: decider?.inTolerance ? "pass" : "fail",
  };
}

export type MeasurementOverall = "pass" | "fail" | "na";

export type EvaluatedPoint<K extends string> = {
  kind: K;
  result: PointResult;
};

export type PointSetResult<K extends string> = {
  points: Array<EvaluatedPoint<K>>;
  overall: MeasurementOverall;
  /** Alguno de los puntos capturados estaba fuera de tolerancia como as-found. */
  requiredAdjustment: boolean;
};

/**
 * Evalúa el conjunto de puntos capturados de un dispositivo.
 * Sirve para los layouts RANGE (low + high), SETPOINT y SINGLE_POINT.
 *
 * - Sin puntos capturados: na
 * - Algún punto capturado falla: fail
 * - Todos los puntos capturados pasan: pass
 */
export function evaluatePointSet<K extends string>(
  inputs: Array<{ kind: K; input: PointInput }>
): PointSetResult<K> {
  const points = inputs.map(({ kind, input }) => ({
    kind,
    result: evaluatePoint(input),
  }));

  // Un punto sin ningún pase capturado no cuenta para el estado del conjunto.
  const captured = points.filter(
    (point) => point.result.asFound !== null || point.result.asLeft !== null
  );

  if (captured.length === 0) {
    return { points, overall: "na", requiredAdjustment: false };
  }

  return {
    points,
    overall: captured.every((point) => point.result.status === "pass") ? "pass" : "fail",
    requiredAdjustment: captured.some((point) => point.result.requiredAdjustment),
  };
}

export type TestReadingsInput = {
  target: DecimalLike;
  readings: Array<DecimalLike | null | undefined>;
  toleranceValue: DecimalLike;
  toleranceIsPercent: boolean;
};

export type TestReadingResult = {
  sequence: number;
  value: Decimal | null;
  deviation: Decimal | null;
  inTolerance: boolean | null;
};

export type TestReadingsResult = {
  toleranceAbsolute: Decimal;
  readings: TestReadingResult[];
  overall: MeasurementOverall;
};

/**
 * Evalúa corridas de ensayo repetidas contra un target común (layout
 * TEST_READINGS: Ultrasonic, Metering Pump). Cada lectura debe caer dentro de
 * la tolerancia; no hay noción de as-found/as-left porque no se ajusta nada
 * entre corridas.
 *
 * Las lecturas vacías se ignoran: permiten guardar una captura parcial.
 */
export function evaluateTestReadings(input: TestReadingsInput): TestReadingsResult {
  const target = new Decimal(input.target);
  const toleranceAbsolute = resolveToleranceAbsolute(
    target,
    new Decimal(input.toleranceValue),
    input.toleranceIsPercent
  );

  const readings = input.readings.map((raw, index) => {
    const sequence = index + 1;

    if (!hasValue(raw)) {
      return { sequence, value: null, deviation: null, inTolerance: null };
    }

    const value = new Decimal(raw);
    const deviation = value.minus(target);

    return {
      sequence,
      value,
      deviation,
      inTolerance: deviation.abs().lte(toleranceAbsolute),
    };
  });

  const captured = readings.filter((reading) => reading.inTolerance !== null);

  const overall: MeasurementOverall =
    captured.length === 0
      ? "na"
      : captured.every((reading) => reading.inTolerance)
        ? "pass"
        : "fail";

  return { toleranceAbsolute, readings, overall };
}

export type CertificateOverallStatus = "pass" | "fail" | "mixed" | "pending";

/**
 * Agrega el status de todos los measurements de un certificado.
 * - pending: hay measurements incompletos, o ninguno aplica
 * - pass: todos los relevantes pasan
 * - fail: todos los relevantes fallan
 * - mixed: mezcla de pass y fail
 * - na se ignora en la agregación
 */
export function aggregateCertificateStatus(
  statuses: Array<MeasurementOverall | "pending">
): CertificateOverallStatus {
  if (statuses.some((status) => status === "pending")) return "pending";

  const relevant = statuses.filter((status) => status !== "na");
  if (relevant.length === 0) return "pending";

  if (relevant.every((status) => status === "pass")) return "pass";
  if (relevant.every((status) => status === "fail")) return "fail";

  return "mixed";
}

/**
 * Redondea un Decimal a N decimales (útil para display).
 * No modifica el valor persistido.
 */
export function roundForDisplay(value: Decimal, decimals: number): string {
  return value.toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP).toString();
}

import { CertificateLayout, CertificateType, PointKind } from "@prisma/client";
import { translate, type Locale, type MessageKey } from "@/lib/i18n";

/**
 * Registry único de certificados.
 *
 * Cada página de certificado del reporte VST es un CertificateType. Los 13 tipos
 * se agrupan en 5 layouts (cómo se capturan y se dibujan) y esos 5 layouts se
 * persisten en 3 formas: MeasurementPoint, TestReading, VerificationRow.
 *
 * Todo lo específico de un certificado vive acá. El formulario, el servicio y el
 * PDF hacen switch sobre el layout, nunca sobre el tipo.
 */

export type CertificateConfig = {
  /** Slug de la ruta del wizard. */
  route: string;
  label: string;
  layout: CertificateLayout;
  /** Página del PDF original. Define el orden del wizard y del PDF final. */
  pdfPage: number;
  /** Puntos capturables. Vacío para TEST_READINGS y VERIFICATION. */
  pointKinds: readonly PointKind[];
  /** Sustantivo de la magnitud medida, para los rótulos del formulario. */
  measuredQuantity: string;
  /**
   * EOL Flow y VAC Flow no imprimen la fila de deviation en el PDF original,
   * aunque la calculamos igual.
   */
  showDeviation: boolean;
  /** Rótulo de la condición de ensayo (layout SETPOINT). */
  conditionLabel?: string;
  /** Cantidad de corridas de ensayo (layout TEST_READINGS). */
  testReadingCount?: number;
  /** ¿Está implementada la captura en la app? */
  implemented: boolean;
};

export const CERTIFICATE_CONFIG: Record<CertificateType, CertificateConfig> = {
  [CertificateType.TEMPERATURE]: {
    route: "temperature",
    label: "Temperature",
    layout: CertificateLayout.RANGE,
    pdfPage: 3,
    pointKinds: [PointKind.LOW, PointKind.HIGH],
    measuredQuantity: "temperature",
    showDeviation: true,
    implemented: true,
  },
  [CertificateType.CHAMBER_VST_AIR_FLOW]: {
    route: "chamber-vst-air-flow",
    label: "Chamber VST Supply Air Flow",
    layout: CertificateLayout.SETPOINT,
    pdfPage: 4,
    pointKinds: [PointKind.LOW, PointKind.HIGH],
    measuredQuantity: "air flow",
    showDeviation: true,
    conditionLabel: "Blower Speed",
    implemented: true,
  },
  [CertificateType.CHAMBER_STERILE_AIR_FLOW]: {
    route: "chamber-sterile-air-flow",
    label: "Filling Chamber Sterile Air Flow",
    layout: CertificateLayout.SETPOINT,
    pdfPage: 5,
    pointKinds: [PointKind.LOW, PointKind.HIGH],
    measuredQuantity: "air flow",
    showDeviation: true,
    conditionLabel: "Blower Speed",
    implemented: true,
  },
  [CertificateType.PRESSURE]: {
    route: "pressure",
    label: "Pressure",
    layout: CertificateLayout.RANGE,
    pdfPage: 6,
    pointKinds: [PointKind.LOW, PointKind.HIGH],
    measuredQuantity: "pressure",
    showDeviation: true,
    implemented: true,
  },
  [CertificateType.VACUUM_TANK_PRESSURE]: {
    route: "vacuum-tank-pressure",
    label: "Vacuum Tank Pressure",
    layout: CertificateLayout.RANGE,
    pdfPage: 7,
    pointKinds: [PointKind.LOW, PointKind.HIGH],
    measuredQuantity: "vacuum pressure",
    showDeviation: true,
    implemented: true,
  },
  [CertificateType.EOL_FLOW]: {
    route: "eol-flow",
    label: "End of Line Flow",
    layout: CertificateLayout.RANGE,
    pdfPage: 8,
    pointKinds: [PointKind.LOW, PointKind.HIGH],
    measuredQuantity: "flow",
    showDeviation: false,
    implemented: true,
  },
  [CertificateType.VAC_FLOW]: {
    route: "vac-flow",
    label: "Vacuum Circuit Flow",
    layout: CertificateLayout.RANGE,
    pdfPage: 9,
    pointKinds: [PointKind.LOW, PointKind.HIGH],
    measuredQuantity: "flow",
    showDeviation: false,
    implemented: true,
  },
  [CertificateType.HUMIDITY]: {
    route: "humidity",
    label: "Humidity",
    layout: CertificateLayout.SINGLE_POINT,
    pdfPage: 10,
    pointKinds: [PointKind.SINGLE],
    measuredQuantity: "relative humidity",
    showDeviation: true,
    implemented: true,
  },
  [CertificateType.ULTRASONIC]: {
    route: "ultrasonic",
    label: "Reservoir Ultrasonic Sensor",
    layout: CertificateLayout.TEST_READINGS,
    pdfPage: 11,
    pointKinds: [],
    measuredQuantity: "mass",
    showDeviation: true,
    testReadingCount: 2,
    implemented: false,
  },
  [CertificateType.METERING_PUMP_CHAMBER]: {
    route: "metering-pump-chamber",
    label: "Metering Pump (Chamber Sterilization)",
    layout: CertificateLayout.TEST_READINGS,
    pdfPage: 12,
    pointKinds: [],
    measuredQuantity: "mass",
    showDeviation: true,
    testReadingCount: 2,
    implemented: false,
  },
  [CertificateType.METERING_PUMP_TUNNEL]: {
    route: "metering-pump-tunnel",
    label: "Metering Pump (Tunnel Sterilization)",
    layout: CertificateLayout.TEST_READINGS,
    pdfPage: 13,
    pointKinds: [],
    measuredQuantity: "mass",
    showDeviation: true,
    testReadingCount: 2,
    implemented: false,
  },
  [CertificateType.EXHAUST]: {
    route: "exhaust",
    label: "Exhaust Verification",
    layout: CertificateLayout.VERIFICATION,
    pdfPage: 14,
    pointKinds: [],
    measuredQuantity: "air flow",
    showDeviation: false,
    implemented: false,
  },
  [CertificateType.VACUUM_PRESSURE]: {
    route: "vacuum-pressure",
    label: "Vacuum Pressure",
    layout: CertificateLayout.RANGE,
    pdfPage: 15,
    pointKinds: [PointKind.LOW, PointKind.HIGH],
    measuredQuantity: "vacuum pressure",
    showDeviation: true,
    implemented: true,
  },
};

const allCertificateTypes = Object.keys(CERTIFICATE_CONFIG) as CertificateType[];

/** Todos los tipos, en el orden de las páginas del PDF. */
export const certificateTypesInPdfOrder = [...allCertificateTypes].sort(
  (a, b) => CERTIFICATE_CONFIG[a].pdfPage - CERTIFICATE_CONFIG[b].pdfPage
);

/** Tipos cuya captura ya existe en la app, en orden de wizard. */
export const implementedCertificateTypes = certificateTypesInPdfOrder.filter(
  (type) => CERTIFICATE_CONFIG[type].implemented
);

export function getCertificateConfig(type: CertificateType): CertificateConfig {
  return CERTIFICATE_CONFIG[type];
}

const certificateLabelsEs: Record<CertificateType, string> = {
  [CertificateType.TEMPERATURE]: "Temperatura",
  [CertificateType.CHAMBER_VST_AIR_FLOW]: "Caudal de aire de suministro VST de la cámara",
  [CertificateType.CHAMBER_STERILE_AIR_FLOW]: "Caudal de aire estéril de la cámara de llenado",
  [CertificateType.PRESSURE]: "Presión",
  [CertificateType.VACUUM_TANK_PRESSURE]: "Presión del tanque de vacío",
  [CertificateType.EOL_FLOW]: "Caudal de fin de línea",
  [CertificateType.VAC_FLOW]: "Caudal del circuito de vacío",
  [CertificateType.HUMIDITY]: "Humedad",
  [CertificateType.ULTRASONIC]: "Sensor ultrasónico del depósito",
  [CertificateType.METERING_PUMP_CHAMBER]: "Bomba dosificadora (esterilización de cámara)",
  [CertificateType.METERING_PUMP_TUNNEL]: "Bomba dosificadora (esterilización de túnel)",
  [CertificateType.EXHAUST]: "Verificación del escape",
  [CertificateType.VACUUM_PRESSURE]: "Presión de vacío",
};

export function getCertificateLabel(type: CertificateType, locale: Locale): string {
  return locale === "es" ? certificateLabelsEs[type] : CERTIFICATE_CONFIG[type].label;
}

const quantityKeys: Record<string, MessageKey> = {
  temperature: "quantity.temperature",
  "air flow": "quantity.airFlow",
  pressure: "quantity.pressure",
  "vacuum pressure": "quantity.vacuumPressure",
  flow: "quantity.flow",
  "relative humidity": "quantity.relativeHumidity",
  mass: "quantity.mass",
};

export function getMeasuredQuantity(type: CertificateType, locale: Locale): string {
  const quantity = CERTIFICATE_CONFIG[type].measuredQuantity;
  const key = quantityKeys[quantity];
  return key ? translate(locale, key) : quantity;
}

export function getConditionLabel(type: CertificateType, locale: Locale): string | null {
  const label = CERTIFICATE_CONFIG[type].conditionLabel;
  if (!label) return null;
  return label === "Blower Speed" ? translate(locale, "condition.blowerSpeed") : label;
}

export function getPointKindLabel(kind: PointKind, locale: Locale): string {
  if (kind === PointKind.LOW) return translate(locale, "point.low");
  if (kind === PointKind.HIGH) return translate(locale, "point.high");
  return translate(locale, "point.verification");
}

export function getCertificateLayout(type: CertificateType): CertificateLayout {
  return CERTIFICATE_CONFIG[type].layout;
}

export function isPointLayout(layout: CertificateLayout): boolean {
  return (
    layout === CertificateLayout.RANGE ||
    layout === CertificateLayout.SETPOINT ||
    layout === CertificateLayout.SINGLE_POINT
  );
}

const typeByRoute = new Map(
  allCertificateTypes.map((type) => [CERTIFICATE_CONFIG[type].route, type])
);

export function parseCertificateRouteType(value: string): CertificateType | null {
  const type = typeByRoute.get(value);
  if (!type) return null;
  if (!CERTIFICATE_CONFIG[type].implemented) return null;
  return type;
}

export function certificateHref(reportId: string, type: CertificateType): string {
  return `/reports/${reportId}/wizard/cert/${CERTIFICATE_CONFIG[type].route}`;
}

/**
 * Siguiente paso del wizard tras guardar un certificado.
 * Al terminar el último implementado, vuelve al detalle del reporte.
 */
export function getNextCertificateHref(params: {
  reportId: string;
  certificateType: CertificateType;
}): string {
  const index = implementedCertificateTypes.indexOf(params.certificateType);
  const next = index >= 0 ? implementedCertificateTypes[index + 1] : undefined;

  return next ? certificateHref(params.reportId, next) : `/reports/${params.reportId}`;
}

/**
 * Targets sugeridos por certificado, tomados del reporte de referencia.
 * Son valores por defecto editables, no constantes de negocio.
 */
export function getDefaultTargets(params: {
  certificateType: CertificateType;
  description: string;
}): Partial<Record<PointKind, string>> {
  const description = params.description.toLowerCase();

  switch (params.certificateType) {
    case CertificateType.TEMPERATURE:
      return {
        [PointKind.LOW]:
          description.includes("vaporizer") || description.includes("pre heater")
            ? "40"
            : "",
        [PointKind.HIGH]: "121.5",
      };
    case CertificateType.VACUUM_PRESSURE:
      return { [PointKind.LOW]: "-5.0", [PointKind.HIGH]: "-25.0" };
    case CertificateType.VACUUM_TANK_PRESSURE:
      return { [PointKind.LOW]: "-5.0", [PointKind.HIGH]: "-25.0" };
    case CertificateType.EOL_FLOW:
    case CertificateType.VAC_FLOW:
      return { [PointKind.LOW]: "6.5", [PointKind.HIGH]: "18.5" };
    case CertificateType.CHAMBER_VST_AIR_FLOW:
      return { [PointKind.LOW]: "10.0", [PointKind.HIGH]: "20.0" };
    case CertificateType.CHAMBER_STERILE_AIR_FLOW:
      return { [PointKind.LOW]: "20.0", [PointKind.HIGH]: "80.0" };
    default:
      return {};
  }
}

export const pointKindLabels: Record<PointKind, string> = {
  [PointKind.LOW]: "Low Point",
  [PointKind.HIGH]: "High Point",
  [PointKind.SINGLE]: "Verification",
};

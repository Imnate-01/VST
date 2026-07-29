import { describe, expect, it } from "vitest";
import {
  canonicalizePayload,
  hashSignaturePayload,
  type CertificateSignaturePayload,
  type ReportSignaturePayload,
} from "./signature-payload";

function certificatePayload(
  overrides: Partial<CertificateSignaturePayload> = {}
): CertificateSignaturePayload {
  return {
    scope: "certificate",
    reportNumber: "CR_Nestle_20260512_CC_Rev2",
    certificateType: "VACUUM_PRESSURE",
    overallStatus: "PASS",
    standards: [
      {
        role: "primary",
        description: "Precision Pressure Gauge",
        manufacturer: "FLUKE",
        model: "700G06",
        serial: "4792075",
        certificationStatus: "CERTIFIED",
        certNumber: "680724",
        calibrationDate: "2026-02-24",
        validTo: "2027-02-24",
      },
    ],
    notes: null,
    measurements: [
      {
        tagNumber: "1706",
        description: "Station 3 - Vacuum Sensor - PS",
        toleranceValue: "0.10",
        toleranceUnit: "Hg",
        toleranceIsPercent: true,
        displayOrder: 30,
        status: "PASS",
        requiredAdjustment: true,
        correctionMethod: null,
        notes: "Se ajustó el sensor 1706.",
        points: [
          { kind: "LOW", notApplicable: false, targetNominal: "-5", asFoundReference: "-5", asFoundReading: "-4.8", asLeftReference: "-5", asLeftReading: "-5" },
          { kind: "HIGH", notApplicable: false, targetNominal: "-25", asFoundReference: "-25", asFoundReading: "-28.8", asLeftReference: "-25", asLeftReading: "-25" },
        ],
      },
      {
        tagNumber: "1702",
        description: "Station 1 - Vacuum Sensor - PS",
        toleranceValue: "0.10",
        toleranceUnit: "Hg",
        toleranceIsPercent: true,
        displayOrder: 10,
        status: "PASS",
        requiredAdjustment: false,
        correctionMethod: null,
        notes: null,
        points: [{ kind: "HIGH", notApplicable: false, targetNominal: "-25", asFoundReference: "-25", asFoundReading: "-25", asLeftReference: null, asLeftReading: null }],
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
            { kind: "LOW", notApplicable: false, targetNominal: "-5", asFoundReference: "-5", asFoundReading: "-4.8", asLeftReference: "-5", asLeftReading: "-5" },
            { kind: "HIGH", notApplicable: false, targetNominal: "-25", asFoundReference: "-25", asFoundReading: "-28.8", asLeftReference: "-25", asLeftReading: "-24" },
          ],
        },
        base.measurements[1]!,
      ],
    });

    expect(hashSignaturePayload(tampered)).not.toBe(hashSignaturePayload(base));
  });

  it("marcar un punto como N/A cambia el hash", () => {
    // Un punto N/A guarda todos sus valores en null, igual que uno vacío: sin
    // el flag en el payload, el certificado imprimiría N/A bajo una firma que
    // se hizo sobre un punto sin capturar.
    const base = certificatePayload();
    const tampered = certificatePayload({
      measurements: [
        {
          ...base.measurements[1]!,
          points: [
            {
              kind: "HIGH",
              notApplicable: true,
              targetNominal: null,
              asFoundReference: null,
              asFoundReading: null,
              asLeftReference: null,
              asLeftReading: null,
            },
          ],
        },
      ],
    });
    const empty = certificatePayload({
      measurements: [
        {
          ...base.measurements[1]!,
          points: [
            {
              kind: "HIGH",
              notApplicable: false,
              targetNominal: null,
              asFoundReference: null,
              asFoundReading: null,
              asLeftReference: null,
              asLeftReading: null,
            },
          ],
        },
      ],
    });

    expect(hashSignaturePayload(tampered)).not.toBe(hashSignaturePayload(empty));
  });

  it("editar el catálogo cambia el hash del certificado", () => {
    // El paso de dispositivos refresca los snapshots desde el catálogo. Si un
    // admin corrige la descripción o afloja la tolerancia, la columna impresa
    // cambia sin que nadie toque una medición: el hash tiene que moverse.
    const base = certificatePayload();
    const first = base.measurements[0]!;

    expect(
      hashSignaturePayload(
        certificatePayload({
          measurements: [{ ...first, description: "Otra descripción" }, base.measurements[1]!],
        })
      )
    ).not.toBe(hashSignaturePayload(base));

    expect(
      hashSignaturePayload(
        certificatePayload({
          measurements: [{ ...first, toleranceValue: "0.50" }, base.measurements[1]!],
        })
      )
    ).not.toBe(hashSignaturePayload(base));

    expect(
      hashSignaturePayload(
        certificatePayload({
          measurements: [{ ...first, toleranceUnit: "PSI" }, base.measurements[1]!],
        })
      )
    ).not.toBe(hashSignaturePayload(base));

    expect(
      hashSignaturePayload(
        certificatePayload({
          measurements: [{ ...first, toleranceIsPercent: false }, base.measurements[1]!],
        })
      )
    ).not.toBe(hashSignaturePayload(base));
  });

  it("reordenar las columnas cambia el hash", () => {
    // `displayOrder` define en qué posición sale cada columna del certificado.
    const base = certificatePayload();
    const reordered = certificatePayload({
      measurements: [
        { ...base.measurements[0]!, displayOrder: 99 },
        base.measurements[1]!,
      ],
    });

    expect(hashSignaturePayload(reordered)).not.toBe(hashSignaturePayload(base));
  });

  it("cambiar el patrón principal cambia el hash", () => {
    const base = certificatePayload();
    const tampered = certificatePayload({
      standards: [{ ...base.standards[0]!, serial: "OTRO-SERIAL" }],
    });

    expect(hashSignaturePayload(tampered)).not.toBe(hashSignaturePayload(base));
  });

  it("refrescar la certificación del patrón cambia el hash", () => {
    // El bloque de validación imprime número de certificado y vigencia: si el
    // snapshot se refresca, la página deja de coincidir con lo firmado.
    const base = certificatePayload();

    expect(
      hashSignaturePayload(
        certificatePayload({
          standards: [{ ...base.standards[0]!, certNumber: "999999" }],
        })
      )
    ).not.toBe(hashSignaturePayload(base));

    expect(
      hashSignaturePayload(
        certificatePayload({
          standards: [{ ...base.standards[0]!, validTo: "2028-01-01" }],
        })
      )
    ).not.toBe(hashSignaturePayload(base));
  });

  it("agregar un patrón complementario cambia el hash", () => {
    const base = certificatePayload();
    const tampered = certificatePayload({
      standards: [
        base.standards[0]!,
        {
          role: "additional",
          description: "Precision Weight",
          manufacturer: "TROEMNER",
          model: "200g",
          serial: "3264",
          certificationStatus: "NOT_APPLICABLE",
          certNumber: null,
          calibrationDate: null,
          validTo: null,
        },
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

describe("payload del reporte", () => {
  function reportPayload(
    overrides: Partial<ReportSignaturePayload> = {}
  ): ReportSignaturePayload {
    return {
      scope: "report",
      reportNumber: "CR_Nestle_20260512_CC_Rev2",
      serviceDate: "2026-05-12",
      fillerSerial: "652",
      observations: null,
      checklist: [
        { tagNumber: "1573", description: "Sensor 1573", deviceType: "RTD", toleranceValue: "1.0", toleranceUnit: "°C", toleranceIsPercent: false, certificateTypes: ["TEMPERATURE"], displayOrder: 10, included: true, exclusionReason: null },
        { tagNumber: "1607", description: "Sensor 1607", deviceType: "RTD", toleranceValue: "1.0", toleranceUnit: "°C", toleranceIsPercent: false, certificateTypes: ["TEMPERATURE"], displayOrder: 40, included: true, exclusionReason: null },
      ],
      certificates: [{ certificateType: "TEMPERATURE", payloadHash: "abc" }],
      ...overrides,
    };
  }

  it("es estable frente al orden del checklist", () => {
    const base = reportPayload();
    const reversed = reportPayload({ checklist: [...base.checklist].reverse() });

    expect(canonicalizePayload(base)).toBe(canonicalizePayload(reversed));
  });

  it("excluir un dispositivo cambia el hash", () => {
    // El alcance se imprime en la página de alcance: si no entrara al payload,
    // excluir un sensor no movería la firma general.
    const base = reportPayload();
    const excluded = reportPayload({
      checklist: [
        base.checklist[0]!,
        { tagNumber: "1607", description: "Sensor 1607", deviceType: "RTD", toleranceValue: "1.0", toleranceUnit: "°C", toleranceIsPercent: false, certificateTypes: ["TEMPERATURE"], displayOrder: 40, included: false, exclusionReason: "Fuera de alcance" },
      ],
    });

    expect(hashSignaturePayload(excluded)).not.toBe(hashSignaturePayload(base));
  });

  it("cambiar el motivo de exclusión cambia el hash", () => {
    const base = reportPayload({
      checklist: [{ tagNumber: "1607", description: "Sensor 1607", deviceType: "RTD", toleranceValue: "1.0", toleranceUnit: "°C", toleranceIsPercent: false, certificateTypes: ["TEMPERATURE"], displayOrder: 40, included: false, exclusionReason: "Sensor dañado" }],
    });
    const other = reportPayload({
      checklist: [{ tagNumber: "1607", description: "Sensor 1607", deviceType: "RTD", toleranceValue: "1.0", toleranceUnit: "°C", toleranceIsPercent: false, certificateTypes: ["TEMPERATURE"], displayOrder: 40, included: false, exclusionReason: "Fuera de alcance" }],
    });

    expect(hashSignaturePayload(other)).not.toBe(hashSignaturePayload(base));
  });

  it("cambiar fecha, filler u observaciones cambia el hash", () => {
    const base = hashSignaturePayload(reportPayload());

    expect(hashSignaturePayload(reportPayload({ serviceDate: "2026-05-13" }))).not.toBe(base);
    expect(hashSignaturePayload(reportPayload({ fillerSerial: "653" }))).not.toBe(base);
    expect(hashSignaturePayload(reportPayload({ observations: "Otra cosa" }))).not.toBe(base);
    expect(hashSignaturePayload(reportPayload({ reportNumber: "CR_X" }))).not.toBe(base);
  });

  it("editar el catálogo cambia el hash del reporte", () => {
    // Mismo escenario, del lado de la página de alcance: ahí se imprimen tipo,
    // tolerancia y certificados de cada dispositivo.
    const base = reportPayload();
    const first = base.checklist[0]!;

    for (const override of [
      { description: "Otra descripción" },
      { deviceType: "PS" },
      { toleranceValue: "2.0" },
      { toleranceUnit: "PSI" },
      { toleranceIsPercent: true },
      { certificateTypes: ["PRESSURE"] },
      { displayOrder: 99 },
    ]) {
      expect(
        hashSignaturePayload(
          reportPayload({ checklist: [{ ...first, ...override }, base.checklist[1]!] })
        ),
        JSON.stringify(override)
      ).not.toBe(hashSignaturePayload(base));
    }
  });

  it("perder un certificado firmado cambia el hash", () => {
    const base = reportPayload();

    expect(hashSignaturePayload(reportPayload({ certificates: [] }))).not.toBe(
      hashSignaturePayload(base)
    );
  });
});

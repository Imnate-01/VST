import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Un dispositivo excluido conserva su tag y su descripción en el certificado;
 * el N/A va solo en sus celdas de medición. Es lo que hace el reporte original
 * con los RTD 1605 y 1607, y ya se rompió dos veces al reestilar el documento.
 *
 * Renderizar el PDF acá requeriría datos de Prisma, así que se verifica la regla
 * en la fuente: las filas de identidad deben pasar `identity`, y `identity` no
 * debe ser lo mismo que el resaltado visual `strong`.
 */
const source = readFileSync(join(__dirname, "report-document.tsx"), "utf8");
const logoSource = readFileSync(join(__dirname, "sig-logo.tsx"), "utf8");
const wizardSource = readFileSync(
  join(__dirname, "..", "..", "components", "wizard", "step-certificate-form.tsx"),
  "utf8"
);

function rowProps(label: string): string {
  const match = source.match(
    new RegExp(`<DataRow\\s+label="${label}"[\\s\\S]*?/>`, "m")
  );
  if (!match) throw new Error(`No se encontró la fila ${label}`);
  return match[0];
}

describe("filas de identidad del certificado", () => {
  it("Tag Number es una fila de identidad", () => {
    expect(rowProps("Tag Number")).toContain("identity");
  });

  it("Description es una fila de identidad", () => {
    expect(rowProps("Description")).toContain("identity");
  });

  it("Target reference NO es una fila de identidad", () => {
    expect(rowProps("Target reference \\(nominal\\)")).not.toContain("identity");
  });

  it("Reading NO es una fila de identidad", () => {
    expect(rowProps("Reading \\(As Found\\)")).not.toContain("identity");
  });

  it("no imprime filas de referencia real", () => {
    expect(source).not.toContain('label="Actual reference"');
    expect(wizardSource).not.toContain("measurement.actualReference");
  });

  it("imprime las observaciones dentro de la tabla de cada sensor", () => {
    expect(source).toContain("pick={(column) => column.notes}");
    expect(wizardSource).toContain(
      "`measurements.${measurementIndex}.notes`"
    );
  });

  it("colorea lecturas y desviaciones según su tolerancia", () => {
    expect(source).toContain('cellTone === "pass" ? styles.passDataCell');
    expect(source).toContain('cellTone === "fail" ? styles.failDataCell');
    expect(source).toContain("asFoundInTolerance");
    expect(source).toContain("asLeftInTolerance");
    expect(source).toContain("readingAt(column, sequence)?.inTolerance");
  });

  it("imprime Pass/Fail en la celda evaluada de cada pase", () => {
    expect(
      source.match(/label=\{t\("measurement\.passFail"\)\}/g)
    ).toHaveLength(3);
    expect(source).toContain(
      't(inTolerance ? "measurement.pass" : "measurement.fail")'
    );
  });

  it("identity controla el contenido y strong el estilo", () => {
    // La celda va a N/A si el dispositivo está excluido o el punto no aplica,
    // y nunca en una fila de identidad: el tag y la descripción se conservan.
    expect(source).toContain(
      "const blank = column.excluded || (notApplicable?.(column) ?? false)"
    );
    expect(source).toContain("blank && !identity ? NA");
    // El resaltado depende de strong, no de identity.
    expect(source).toContain("strong ? styles.identity : {}");
  });

  it("imprime N/A en el punto que no aplica al dispositivo", () => {
    // Los RTD de túnel y cámara solo se calibran en el punto alto: su punto
    // bajo va en N/A sin que el dispositivo quede excluido del certificado.
    const rows = source.match(
      /notApplicable=\{\(c\) => pointOf\(c, kind\)\?\.notApplicable \?\? false\}/g
    );
    expect(rows).toHaveLength(8);
  });
});

describe("alcance y trazabilidad", () => {
  it("lista los patrones del reporte, no el patrón de cada certificado", () => {
    expect(source).toContain("report.standards.map");
    // La tabla se armaba deduplicando el patrón de cada certificado, así que
    // dependía de qué secciones existieran. Ahora sale de la lista del reporte.
    expect(source).not.toContain("certificate.standard,");
  });

  it("declara en qué secciones se usó cada patrón", () => {
    expect(source).toContain("standard.usedIn.join");
  });

  it("imprime el checklist con el motivo de exclusión", () => {
    expect(source).toContain("report.checklist.map");
    expect(source).toContain("row.exclusionReason");
  });
});

describe("términos y condiciones", () => {
  it("cierra el documento con las condiciones comerciales", () => {
    expect(source).toContain("<TermsPage report={report} locale={locale} />");
    expect(source.indexOf("<TermsPage")).toBeGreaterThan(
      source.indexOf("<CoverPage")
    );
  });

  it("reproduce el texto legal sin traducirlo", () => {
    // El cuerpo es literal y en inglés en los dos idiomas: traducirlo cambiaría
    // lo que el cliente acepta. Solo el título y el aviso viven en i18n.
    expect(source).toContain(
      "subject to SIG’s General Terms and Conditions of Sale"
    );
    expect(source).toContain(
      "https://www.sig.biz/en/general-terms-and-conditions-for-customers"
    );
    expect(source).toContain(
      "expressly rejected and shall have no effect unless accepted by SIG in a signed writing."
    );
  });
});

describe("diseño del reporte", () => {
  it("no agrega marca de agua a los PDF borrador", () => {
    expect(source).not.toContain("DraftWatermark");
    expect(source).not.toContain("styles.watermark");
  });

  it("usa el logo PNG oficial", () => {
    expect(logoSource).toContain('public", "logo.png"');
  });

  it("no muestra el método de corrección en wizard ni PDF", () => {
    expect(wizardSource).not.toContain("correctionMethod");
    expect(source).not.toContain("correctionMethodLabel");
  });

  it("usa los tokens principales del sistema visual", () => {
    expect(source).toContain('const BRAND = "#145EFC"');
    expect(source).toContain('const SAND_1 = "#F2EFEB"');
    expect(source).toContain('fontFamily: "Courier-Bold"');
  });
});

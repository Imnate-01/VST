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

  it("UUT reading NO es una fila de identidad", () => {
    expect(rowProps("UUT reading \\(As Found\\)")).not.toContain("identity");
  });

  it("identity controla el contenido y strong el estilo", () => {
    // La celda muestra N/A solo si está excluida y NO es fila de identidad.
    expect(source).toContain("column.excluded && !identity ? NA");
    // El resaltado depende de strong, no de identity.
    expect(source).toContain("strong ? styles.identity : {}");
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

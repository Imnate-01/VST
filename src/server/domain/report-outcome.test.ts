import { describe, expect, it } from "vitest";
import {
  certificateOutcome,
  countChannels,
  reportOutcome,
  type OutcomeCertificate,
} from "./report-outcome";

function certificate(
  overallStatus: string,
  statuses: string[],
  excluded: string[] = []
): OutcomeCertificate {
  return {
    overallStatus,
    columns: statuses.map((status, index) => ({
      status,
      excluded: excluded.includes(String(index)),
    })),
  };
}

describe("certificateOutcome", () => {
  it("todo aprobado y evaluado es pass", () => {
    expect(certificateOutcome(certificate("PASS", ["PASS", "PASS"]))).toBe("pass");
  });

  it("un certificado PENDING no es pass aunque no haya fallas", () => {
    expect(certificateOutcome(certificate("PENDING", ["PENDING", "PENDING"]))).toBe(
      "incomplete"
    );
  });

  it("una captura a medias es incompleta, no aprobada", () => {
    expect(certificateOutcome(certificate("PENDING", ["PASS", "PENDING"]))).toBe(
      "incomplete"
    );
  });

  it("una columna fallada es desviación", () => {
    expect(certificateOutcome(certificate("MIXED", ["PASS", "FAIL"]))).toBe("deviation");
  });

  it("overallStatus FAIL es desviación", () => {
    expect(certificateOutcome(certificate("FAIL", ["FAIL"]))).toBe("deviation");
  });

  it("un certificado sin columnas evaluables es incompleto", () => {
    expect(certificateOutcome(certificate("PENDING", []))).toBe("incomplete");
  });

  it("los dispositivos excluidos no cuentan para el veredicto", () => {
    // El único excluido está en PENDING; el resto aprobó.
    expect(certificateOutcome(certificate("PASS", ["PASS", "PENDING"], ["1"]))).toBe(
      "pass"
    );
  });

  it("los dispositivos N/A tampoco cuentan", () => {
    expect(certificateOutcome(certificate("PASS", ["PASS", "NA"]))).toBe("pass");
  });

  it("una desviación gana sobre lo pendiente dentro del mismo certificado", () => {
    expect(certificateOutcome(certificate("MIXED", ["FAIL", "PENDING"]))).toBe(
      "deviation"
    );
  });
});

describe("reportOutcome", () => {
  it("todos los certificados aprobados es pass", () => {
    expect(
      reportOutcome([certificate("PASS", ["PASS"]), certificate("PASS", ["PASS"])])
    ).toBe("pass");
  });

  it("un certificado sin capturar no puede dar un reporte verde", () => {
    expect(
      reportOutcome([certificate("PASS", ["PASS"]), certificate("PENDING", ["PENDING"])])
    ).toBe("incomplete");
  });

  it("una falla gana sobre lo pendiente", () => {
    expect(
      reportOutcome([certificate("FAIL", ["FAIL"]), certificate("PENDING", ["PENDING"])])
    ).toBe("deviation");
  });

  it("un reporte sin certificados es incompleto", () => {
    expect(reportOutcome([])).toBe("incomplete");
  });
});

describe("countChannels", () => {
  it("cuenta solo los canales evaluables", () => {
    expect(
      countChannels([
        // 3 evaluables, 2 dentro de tolerancia.
        certificate("MIXED", ["PASS", "FAIL", "PASS"]),
        // El N/A no se cuenta: 1 evaluable, 1 aprobado.
        certificate("PASS", ["PASS", "NA"]),
        // El excluido no se cuenta: 1 evaluable, 1 aprobado.
        certificate("PASS", ["PASS", "PASS"], ["1"]),
      ])
    ).toEqual({ pass: 4, total: 5 });
  });

  it("sin certificados no hay canales", () => {
    expect(countChannels([])).toEqual({ pass: 0, total: 0 });
  });
});

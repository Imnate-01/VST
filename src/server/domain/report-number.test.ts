import { describe, it, expect } from "vitest";
import { generateReportNumber } from "./report-number";

describe("generateReportNumber", () => {
  it("genera el formato del reporte real de Nestle", () => {
    const result = generateReportNumber({
      clientName: "NESTLE",
      serviceDate: new Date("2026-05-12T00:00:00Z"),
      fillerModelCode: "SUREFILL_100",
      revisionNumber: 2,
    });
    expect(result).toBe("CR_Nestle_20260512_CC_Rev2");
  });

  it("Rev0 para nuevo reporte", () => {
    const result = generateReportNumber({
      clientName: "Nestle",
      serviceDate: new Date("2026-01-15T00:00:00Z"),
      fillerModelCode: "SUREFILL_100",
      revisionNumber: 0,
    });
    expect(result).toBe("CR_Nestle_20260115_CC_Rev0");
  });

  it("maneja cliente con espacios (usa primera palabra)", () => {
    const result = generateReportNumber({
      clientName: "Nestle USA",
      serviceDate: new Date("2026-05-12T00:00:00Z"),
      fillerModelCode: "SUREFILL_100",
      revisionNumber: 0,
    });
    expect(result).toBe("CR_Nestle_20260512_CC_Rev0");
  });

  it("sanitiza caracteres no alfanuméricos del cliente", () => {
    const result = generateReportNumber({
      clientName: "P&G",
      serviceDate: new Date("2026-05-12T00:00:00Z"),
      fillerModelCode: "SUREFILL_100",
      revisionNumber: 0,
    });
    expect(result).toBe("CR_Pg_20260512_CC_Rev0");
  });
});

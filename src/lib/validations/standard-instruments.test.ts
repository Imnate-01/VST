import { describe, expect, it } from "vitest";
import { getStandardInstrumentSchema } from "./standard-instruments";

const validInstrument = {
  description: "Reference thermometer",
  manufacturer: "Fluke",
  model: "1524",
  serialNumber: "SN-4471-B",
  calibrationCertNumber: "2026-0088",
  calibrationDate: "2026-01-15",
  calibrationExpiresAt: "2027-01-15",
  active: true,
};

describe("standard instrument validation", () => {
  it("accepts a complete instrument", () => {
    expect(getStandardInstrumentSchema("en").safeParse(validInstrument).success).toBe(true);
  });

  it("requires expiration to be after calibration", () => {
    const result = getStandardInstrumentSchema("en").safeParse({
      ...validInstrument,
      calibrationExpiresAt: validInstrument.calibrationDate,
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty required fields", () => {
    const result = getStandardInstrumentSchema("es").safeParse({
      ...validInstrument,
      description: " ",
    });
    expect(result.success).toBe(false);
  });
});

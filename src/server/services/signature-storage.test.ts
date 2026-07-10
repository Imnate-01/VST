import { describe, expect, it } from "vitest";
import { isDataUrl, parseSignatureDataUrl } from "./signature-storage";

const PIXEL_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("parseSignatureDataUrl", () => {
  it("decodifica un PNG en data URL", () => {
    const buffer = parseSignatureDataUrl(PIXEL_PNG);
    expect(buffer.length).toBeGreaterThan(0);
    // Firma mágica de PNG.
    expect(buffer.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  });

  it("rechaza una firma vacía", () => {
    expect(() => parseSignatureDataUrl("data:image/png;base64,")).toThrow(
      "La firma está vacía"
    );
  });

  it("rechaza un formato que no sea PNG", () => {
    expect(() => parseSignatureDataUrl("data:image/jpeg;base64,AAAA")).toThrow(
      "PNG en data URL"
    );
  });

  it("rechaza una URL que no sea data URL", () => {
    expect(() => parseSignatureDataUrl("https://example.com/firma.png")).toThrow();
  });

  it("rechaza una firma mayor a 1 MB", () => {
    const huge = "data:image/png;base64," + "A".repeat(1_400_000);
    expect(() => parseSignatureDataUrl(huge)).toThrow("tamaño máximo");
  });
});

describe("isDataUrl", () => {
  it("distingue data URL de URL de blob", () => {
    expect(isDataUrl(PIXEL_PNG)).toBe(true);
    expect(isDataUrl("https://blob.vercel-storage.com/signatures/x.png")).toBe(false);
  });
});

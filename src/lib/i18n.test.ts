import { describe, expect, it } from "vitest";
import {
  localizeMeasurementStatusReason,
  translate,
} from "./i18n";

describe("measurement status reason localization", () => {
  it("translates stored adjustment explanations for the English interface", () => {
    expect(
      localizeMeasurementStatusReason(
        "As Found fuera de tolerancia; ajustado y verificado dentro de tolerancia",
        "en"
      )
    ).toBe(
      "As Found was out of tolerance; adjusted and verified within tolerance."
    );
  });

  it("translates stored failure explanations for the English interface", () => {
    expect(
      localizeMeasurementStatusReason(
        "As found fuera de tolerancia y el As Left sigue fuera de tolerancia",
        "en"
      )
    ).toBe(
      "As Found was out of tolerance and As Left remains out of tolerance."
    );
  });

  it("preserves the stable stored wording in Spanish", () => {
    const reason = "As Left fuera de tolerancia";
    expect(localizeMeasurementStatusReason(reason, "es")).toBe(reason);
  });
});

describe("report progress copy", () => {
  it("uses the real wizard total supplied by the interface", () => {
    expect(translate("en", "reports.step", { step: 4, total: 17 })).toBe(
      "Step 4 of 17"
    );
  });
});

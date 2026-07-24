import { describe, expect, it } from "vitest";
import { derivePdfPass } from "./report-data";

describe("derivePdfPass", () => {
  it("calcula la desviación y tolerancia absoluta para datos históricos", () => {
    expect(
      derivePdfPass({
        target: "40",
        reading: "41.25",
        toleranceValue: "1",
        toleranceIsPercent: false,
      })
    ).toEqual({ deviation: "1.25", inTolerance: false });
  });

  it("prefiere la referencia histórica cuando todavía existe", () => {
    expect(
      derivePdfPass({
        reference: "39.9",
        target: "40",
        reading: "40.2",
        toleranceValue: "1",
        toleranceIsPercent: false,
      })
    ).toEqual({ deviation: "0.3", inTolerance: true });
  });

  it("resuelve tolerancias porcentuales", () => {
    expect(
      derivePdfPass({
        target: "100",
        reading: "104",
        toleranceValue: "5",
        toleranceIsPercent: true,
      })
    ).toEqual({ deviation: "4", inTolerance: true });
  });

  it("mantiene vacío un pase sin lectura suficiente", () => {
    expect(
      derivePdfPass({
        target: "40",
        reading: null,
        toleranceValue: "1",
        toleranceIsPercent: false,
      })
    ).toEqual({ deviation: null, inTolerance: null });
  });

  it("reconstruye los cuatro resultados LOW/HIGH de Temperature", () => {
    const temperaturePasses = [
      { target: "40", reading: "42.2" },
      { target: "40", reading: "40" },
      { target: "121.5", reading: "121.9" },
      { target: "121.5", reading: "121.5" },
    ].map(({ target, reading }) =>
      derivePdfPass({
        target,
        reading,
        toleranceValue: "1",
        toleranceIsPercent: false,
      })
    );

    expect(temperaturePasses).toEqual([
      { deviation: "2.2", inTolerance: false },
      { deviation: "0", inTolerance: true },
      { deviation: "0.4", inTolerance: true },
      { deviation: "0", inTolerance: true },
    ]);
  });
});

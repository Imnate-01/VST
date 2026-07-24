import { describe, expect, it } from "vitest";
import { isOfflineNavigationAllowed } from "@/lib/navigation-protection";

describe("isOfflineNavigationAllowed", () => {
  const current = "/reports/report-1/wizard/cert/temperature";

  it("permite continuar dentro del wizard del mismo reporte", () => {
    expect(
      isOfflineNavigationAllowed(current, "/reports/report-1/wizard/review")
    ).toBe(true);
  });

  it("bloquea secciones globales y otros reportes", () => {
    expect(isOfflineNavigationAllowed(current, "/profile")).toBe(false);
    expect(
      isOfflineNavigationAllowed(current, "/reports/report-2/wizard/info")
    ).toBe(false);
  });

  it("permite un enlace que no cambia de ruta", () => {
    expect(isOfflineNavigationAllowed(current, current)).toBe(true);
  });
});

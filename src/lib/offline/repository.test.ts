import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { OfflineDatabase, __setDbForTests, getDb } from "@/lib/offline/db";
import { hydrateBundle } from "@/lib/offline/repository";
import type { OfflineReportBundle } from "@/lib/offline/bundle-types";

function makeBundle(): OfflineReportBundle {
  return {
    version: 1,
    fetchedAt: "2026-07-24T00:00:00.000Z",
    report: {
      id: "r1",
      reportNumber: "CR_Test_20260724_CC_Rev0",
      status: "DRAFT",
      serviceDate: "2026-07-24T00:00:00.000Z",
      observations: null,
      filler: {
        serialNumber: "SN1",
        modelName: "SureFill 100",
        clientName: "ACME",
        clientAddress: "1 St",
        clientCity: "City",
        clientState: "ST",
        clientZip: "0000",
      },
      preparedBy: { id: "u1", name: "Eng", title: "FSE II", email: "e@e.com" },
      updatedAt: "2026-07-24T00:00:00.000Z",
    },
    standards: [],
    certificates: [
      {
        id: "c1",
        certificateType: "TEMPERATURE",
        layout: "RANGE",
        params: null,
        overallStatus: "PENDING",
        primaryStandard: { descriptionSnapshot: "Gauge", serialSnapshot: "G1" },
        deviceSelections: [
          {
            id: "sel1",
            tagNumberSnapshot: "1706",
            descriptionSnapshot: "Chamber RTD",
            toleranceValueSnapshot: "1.0",
            toleranceUnitSnapshot: "°C",
            toleranceIsPercentSnapshot: false,
            certificateTypesSnapshot: ["TEMPERATURE"],
            displayOrderSnapshot: 1,
          },
        ],
        measurements: [],
        verificationRows: [],
      },
    ],
    signatures: [],
  };
}

afterEach(async () => {
  await getDb().delete();
  __setDbForTests(new OfflineDatabase());
});

describe("hydrateBundle", () => {
  it("guarda reporte y certificados desde el bundle", async () => {
    await hydrateBundle(makeBundle());
    const db = getDb();

    const report = await db.reports.get("r1");
    expect(report?.meta.reportNumber).toBe("CR_Test_20260724_CC_Rev0");
    expect(report?.syncState).toBe("synced");

    const cert = await db.certificates.get("c1");
    expect(cert?.reportId).toBe("r1");
    expect(cert?.data.deviceSelections[0]?.tagNumberSnapshot).toBe("1706");
  });

  it("no pisa un certificado con ediciones locales sin sincronizar", async () => {
    await hydrateBundle(makeBundle());
    const db = getDb();

    // Simula edición local pendiente.
    await db.certificates.update("c1", { syncState: "dirty", updatedAt: 999 });

    // Re-descarga (el server no cambió).
    await hydrateBundle(makeBundle());

    const cert = await db.certificates.get("c1");
    expect(cert?.syncState).toBe("dirty");
    expect(cert?.updatedAt).toBe(999);
  });
});

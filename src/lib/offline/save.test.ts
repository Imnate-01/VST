import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";

// Evita arrastrar Prisma/Next al test: la ruta offline no llama a los actions.
vi.mock("@/server/actions/measurements", () => ({
  upsertMeasurement: vi.fn(),
  upsertTestReadings: vi.fn(),
  upsertVerification: vi.fn(),
}));
vi.mock("@/server/actions/signatures", () => ({
  signCertificate: vi.fn(),
}));

import { OfflineDatabase, __setDbForTests, getDb } from "@/lib/offline/db";
import { hydrateBundle } from "@/lib/offline/repository";
import {
  saveMeasurement,
  saveCertificateSignature,
} from "@/lib/offline/save";
import type { OfflineReportBundle } from "@/lib/offline/bundle-types";
import type { UpsertMeasurementInput } from "@/lib/validations/measurements";

function makeBundle(): OfflineReportBundle {
  return {
    version: 1,
    fetchedAt: "2026-07-24T00:00:00.000Z",
    report: {
      id: "r1",
      reportNumber: "CR_Test",
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

const input: UpsertMeasurementInput = {
  reportId: "r1",
  certificateId: "c1",
  certificateType: "TEMPERATURE",
  measurements: [
    {
      deviceSelectionId: "sel1",
      points: [
        { kind: "LOW", targetNominal: "40", asFoundReading: "40.1", asLeftReading: "40.0" },
        { kind: "HIGH", targetNominal: "121.5", asFoundReading: "121.5", asLeftReading: "121.5" },
      ],
    },
  ],
};

afterEach(async () => {
  await getDb().delete();
  __setDbForTests(new OfflineDatabase());
});

describe("saveMeasurement offline", () => {
  it("calcula el estado, escribe Dexie y encola una operación", async () => {
    await hydrateBundle(makeBundle());

    const result = await saveMeasurement(input, false);

    expect(result.ok).toBe(true);
    expect(result.certificateStatus).toBe("PASS");

    const cert = await getDb().certificates.get("c1");
    expect(cert?.syncState).toBe("dirty");
    expect(cert?.local?.mode).toBe("POINTS");
    expect(cert?.data.measurements[0]?.status).toBe("PASS");
    // Desviación calculada localmente (as-left 40.0 vs target 40 = 0).
    expect(cert?.data.measurements[0]?.points[0]?.asLeftDeviation).toBe("0");

    const ops = await getDb().outbox.toArray();
    expect(ops).toHaveLength(1);
    expect(ops[0]?.type).toBe("upsertMeasurement");
    expect(ops[0]?.certificateId).toBe("c1");
  });

  it("reeditar tras firmar revoca la firma local", async () => {
    await hydrateBundle(makeBundle());
    await saveMeasurement(input, false);
    await saveCertificateSignature(
      { reportId: "r1", certificateId: "c1", signatureDataUrl: "data:image/png;base64,AAAA" },
      false
    );

    let cert = await getDb().certificates.get("c1");
    expect(cert?.signature).not.toBeNull();

    // Reeditar: debe revocar la firma (como el servidor).
    await saveMeasurement(input, false);
    cert = await getDb().certificates.get("c1");
    expect(cert?.signature).toBeNull();
  });
});

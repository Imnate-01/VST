import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const calls: string[] = [];

vi.mock("@/server/actions/measurements", () => ({
  upsertMeasurement: vi.fn(async () => {
    calls.push("upsertMeasurement");
    return { ok: true };
  }),
  upsertTestReadings: vi.fn(async () => ({ ok: true })),
  upsertVerification: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/server/actions/signatures", () => ({
  signCertificate: vi.fn(async () => {
    calls.push("signCertificate");
    return { ok: true };
  }),
  signReport: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/offline/repository", () => ({
  downloadReportForOffline: vi.fn(async () => {}),
}));

import { signCertificate } from "@/server/actions/signatures";
import { downloadReportForOffline } from "@/lib/offline/repository";
import {
  OfflineDatabase,
  __setDbForTests,
  enqueueOp,
  getDb,
  type StoredCertificate,
  type StoredReport,
} from "@/lib/offline/db";
import { processOutbox } from "@/lib/offline/sync";

function seedReport(id: string): StoredReport {
  return {
    id,
    meta: {} as StoredReport["meta"],
    standards: [],
    reportSignature: null,
    downloadedAt: "x",
    fetchedAt: "x",
    serverUpdatedAt: "x",
    syncState: "dirty",
  };
}

function seedCert(id: string, reportId: string): StoredCertificate {
  return {
    id,
    reportId,
    data: {} as StoredCertificate["data"],
    signature: null,
    local: { mode: "POINTS", input: {}, rowStatus: {}, overallStatus: "PASS" },
    syncState: "dirty",
    updatedAt: 1,
  };
}

beforeEach(() => {
  calls.length = 0;
});

afterEach(async () => {
  await getDb().delete();
  __setDbForTests(new OfflineDatabase());
  vi.clearAllMocks();
});

describe("processOutbox", () => {
  it("reproduce las operaciones en orden seq (medición antes que firma) y reconcilia", async () => {
    const db = getDb();
    await db.reports.put(seedReport("r1"));
    await db.certificates.put(seedCert("c1", "r1"));

    await enqueueOp({
      reportId: "r1",
      certificateId: "c1",
      type: "upsertMeasurement",
      payload: { reportId: "r1" },
    });
    await enqueueOp({
      reportId: "r1",
      certificateId: "c1",
      type: "signCertificate",
      payload: { reportId: "r1" },
    });

    const summary = await processOutbox();

    expect(calls).toEqual(["upsertMeasurement", "signCertificate"]);
    expect(summary.processed).toBe(2);
    expect(await db.outbox.count()).toBe(0);

    const cert = await db.certificates.get("c1");
    expect(cert?.syncState).toBe("synced");
    expect(cert?.local).toBeNull();
    const report = await db.reports.get("r1");
    expect(report?.syncState).toBe("synced");
  });

  it("marca error y bloquea el resto del reporte si un action falla la validación", async () => {
    vi.mocked(signCertificate).mockResolvedValueOnce({
      ok: false,
      message: "El reporte ya fue enviado.",
    } as never);

    const db = getDb();
    await db.reports.put(seedReport("r1"));
    await db.certificates.put(seedCert("c1", "r1"));

    await enqueueOp({
      reportId: "r1",
      certificateId: "c1",
      type: "signCertificate",
      payload: { reportId: "r1" },
    });
    await enqueueOp({
      reportId: "r1",
      certificateId: "c1",
      type: "upsertMeasurement",
      payload: { reportId: "r1" },
    });

    const summary = await processOutbox();

    expect(summary.failed).toBe(1);
    const ops = await db.outbox.orderBy("seq").toArray();
    expect(ops[0]?.status).toBe("error");
    expect(ops[0]?.lastError).toBe("El reporte ya fue enviado.");
    // La operación siguiente del mismo reporte no se procesó.
    expect(ops[1]?.status).toBe("pending");
    // No se reconcilia un reporte con operaciones fallidas.
    const report = await db.reports.get("r1");
    expect(report?.syncState).toBe("dirty");
  });

  it("limpia la copia local si el reporte ya no es editable (404) al reconciliar", async () => {
    vi.mocked(downloadReportForOffline).mockRejectedValueOnce(
      new Error("bundle_fetch_failed_404")
    );

    const db = getDb();
    await db.reports.put(seedReport("r1"));
    await db.certificates.put(seedCert("c1", "r1"));
    await enqueueOp({
      reportId: "r1",
      certificateId: "c1",
      type: "upsertMeasurement",
      payload: { reportId: "r1" },
    });

    await processOutbox();

    expect(await db.reports.get("r1")).toBeUndefined();
    expect(await db.certificates.where("reportId").equals("r1").count()).toBe(0);
  });
});

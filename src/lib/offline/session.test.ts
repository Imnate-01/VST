import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import {
  OfflineDatabase,
  __setDbForTests,
  getDb,
  type StoredReport,
} from "@/lib/offline/db";
import {
  pendingOfflineOperationCount,
  prepareOfflineSession,
} from "@/lib/offline/session";

afterEach(async () => {
  await getDb().delete();
  __setDbForTests(new OfflineDatabase());
});

describe("offline session isolation", () => {
  it("conserva los datos al refrescar la misma sesión", async () => {
    await prepareOfflineSession({
      userId: "u1",
      role: "ENGINEER",
      name: "User One",
      title: "Engineer",
      locale: "es",
    });
    await getDb().reports.put({
      id: "r1",
      meta: {} as StoredReport["meta"],
      standards: [],
      reportSignature: null,
      downloadedAt: "x",
      fetchedAt: "x",
      serverUpdatedAt: "x",
      syncState: "synced",
    });

    await prepareOfflineSession({
      userId: "u1",
      role: "ENGINEER",
      name: "User One",
      title: "Engineer",
      locale: "en",
    });

    expect(await getDb().reports.count()).toBe(1);
    expect((await getDb().meta.get("session"))?.locale).toBe("en");
  });

  it("limpia datos y cola cuando cambia el usuario", async () => {
    await prepareOfflineSession({
      userId: "u1",
      role: "ENGINEER",
      name: "User One",
      title: "Engineer",
      locale: "es",
    });
    await getDb().reports.put({
      id: "r1",
      meta: {} as StoredReport["meta"],
      standards: [],
      reportSignature: null,
      downloadedAt: "x",
      fetchedAt: "x",
      serverUpdatedAt: "x",
      syncState: "dirty",
    });
    await getDb().outbox.put({
      id: "op1",
      reportId: "r1",
      certificateId: null,
      type: "signReport",
      payload: {},
      seq: 1,
      status: "pending",
      attempts: 0,
      createdAt: 1,
      lastError: null,
    });
    expect(await pendingOfflineOperationCount()).toBe(1);

    await prepareOfflineSession({
      userId: "u2",
      role: "ADMIN",
      name: "User Two",
      title: "Admin",
      locale: "es",
    });

    expect(await getDb().reports.count()).toBe(0);
    expect(await getDb().outbox.count()).toBe(0);
    expect((await getDb().meta.get("session"))?.userId).toBe("u2");
  });
});

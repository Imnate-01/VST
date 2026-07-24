import Dexie, { type EntityTable } from "dexie";
import type { CertificateStatus, MeasurementStatus } from "@prisma/client";
import type {
  OfflineCertificate,
  OfflineReportMeta,
  OfflineSignature,
  OfflineStandard,
} from "@/lib/offline/bundle-types";

/**
 * Store local-first (IndexedDB vía Dexie). Fuente de verdad en el navegador
 * mientras se trabaja sin conexión. El servidor es el origen (seed al descargar)
 * y el destino (sync desde el outbox).
 *
 * Este módulo es solo-cliente: toca IndexedDB. No lo importes desde código de
 * servidor. En tests se usa fake-indexeddb.
 */

export type SyncState = "synced" | "dirty" | "syncing" | "error";

/** Un reporte descargado para trabajar offline. */
export type StoredReport = {
  id: string;
  meta: OfflineReportMeta;
  standards: OfflineStandard[];
  /** Firma general del reporte (página 1), si existe. */
  reportSignature: OfflineSignature | null;
  downloadedAt: string;
  fetchedAt: string;
  /** updatedAt del servidor al descargar; guarda de last-write-wins. */
  serverUpdatedAt: string;
  syncState: SyncState;
};

/** Estado de captura local (aún sin sincronizar) de un certificado. */
export type LocalCertState = {
  mode: "POINTS" | "TEST_READINGS" | "VERIFICATION";
  /** El Upsert*Input tal como lo envió el formulario (misma forma). */
  input: unknown;
  /** Estado por dispositivo, para pintar filas y resúmenes offline. */
  rowStatus: Record<
    string,
    {
      status: MeasurementStatus;
      statusReason: string | null;
      requiredAdjustment: boolean;
    }
  >;
  overallStatus: CertificateStatus;
};

/** Un certificado editable: se guarda y sincroniza como unidad. */
export type StoredCertificate = {
  id: string;
  reportId: string;
  data: OfflineCertificate;
  /** Firma activa del certificado (del servidor o capturada offline). */
  signature: OfflineSignature | null;
  /** Captura local pendiente de sync. null = igual que el servidor. */
  local: LocalCertState | null;
  syncState: SyncState;
  /** Última edición local (ms epoch). Ordena y desempata. */
  updatedAt: number;
};

/** Tipos de operación del outbox: mapean 1:1 a los Server Actions. */
export type OutboxOpType =
  | "upsertMeasurement"
  | "upsertTestReadings"
  | "upsertVerification"
  | "signCertificate"
  | "signReport";

export type OutboxStatus = "pending" | "inflight" | "error" | "done";

export type OutboxOp = {
  id: string;
  reportId: string;
  /** Certificado afectado (para ordenar firmas después de mediciones). */
  certificateId: string | null;
  type: OutboxOpType;
  payload: unknown;
  seq: number;
  status: OutboxStatus;
  attempts: number;
  createdAt: number;
  lastError: string | null;
};

/** Identidad de la sesión, para autoría del outbox y cálculo local. */
export type StoredMeta = {
  key: "session";
  userId: string;
  role: string;
  name: string;
  title: string;
  locale: string;
  seenAt: number;
};

export class OfflineDatabase extends Dexie {
  reports!: EntityTable<StoredReport, "id">;
  certificates!: EntityTable<StoredCertificate, "id">;
  outbox!: EntityTable<OutboxOp, "id">;
  meta!: EntityTable<StoredMeta, "key">;

  constructor() {
    super("vst-offline");
    this.version(1).stores({
      reports: "id, syncState",
      certificates: "id, reportId, syncState",
      outbox: "id, reportId, certificateId, seq, status",
      meta: "key",
    });
  }
}

let instance: OfflineDatabase | null = null;

/** Singleton perezoso: evita abrir IndexedDB en SSR/build. */
export function getDb(): OfflineDatabase {
  if (!instance) {
    instance = new OfflineDatabase();
  }
  return instance;
}

/** Solo para tests: reemplaza la instancia (p.ej. tras borrar la base). */
export function __setDbForTests(db: OfflineDatabase | null) {
  instance = db;
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Encola una operación en el outbox con un `seq` monótono por base. El orden
 * global preserva la dependencia mediciones→firma dentro de un reporte.
 */
export async function enqueueOp(
  op: Omit<OutboxOp, "id" | "seq" | "status" | "attempts" | "createdAt" | "lastError">
): Promise<OutboxOp> {
  const db = getDb();
  const last = await db.outbox.orderBy("seq").last();
  const full: OutboxOp = {
    ...op,
    id: uuid(),
    seq: (last?.seq ?? 0) + 1,
    status: "pending",
    attempts: 0,
    createdAt: Date.now(),
    lastError: null,
  };
  await db.outbox.put(full);
  return full;
}

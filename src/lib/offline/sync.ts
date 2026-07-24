import {
  upsertMeasurement,
  upsertTestReadings,
  upsertVerification,
} from "@/server/actions/measurements";
import { signCertificate, signReport } from "@/server/actions/signatures";
import { downloadReportForOffline } from "@/lib/offline/repository";
import { getDb, type OutboxOp } from "@/lib/offline/db";

/**
 * Sync manager. Reproduce el outbox contra los Server Actions en orden de `seq`
 * (mediciones antes que firmas, porque se encolaron así). Cada operación mapea
 * a un action idempotente, así reproducir es seguro. Al vaciar la cola de un
 * reporte, reconcilia su estado local con el servidor (valores canónicos).
 */

type ActionResult = { ok: boolean; message?: string } | undefined;

async function runOp(op: OutboxOp): Promise<ActionResult> {
  switch (op.type) {
    case "upsertMeasurement":
      return upsertMeasurement(op.payload);
    case "upsertTestReadings":
      return upsertTestReadings(op.payload);
    case "upsertVerification":
      return upsertVerification(op.payload);
    case "signCertificate":
      return signCertificate(op.payload);
    case "signReport":
      return signReport(op.payload);
    default:
      return { ok: false, message: `unknown_op_${op.type as string}` };
  }
}

export type SyncSummary = {
  processed: number;
  failed: number;
  /** true si se cortó por falta de red (reintentar luego). */
  interrupted: boolean;
};

let running = false;

/**
 * Procesa toda la cola una vez. Reentrante-seguro: si ya hay una corrida en
 * curso, no arranca otra. Devuelve un resumen.
 */
export async function processOutbox(): Promise<SyncSummary> {
  if (running) return { processed: 0, failed: 0, interrupted: false };
  // Solo se corta si el navegador reporta explícitamente offline.
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { processed: 0, failed: 0, interrupted: true };
  }
  running = true;

  const db = getDb();
  const summary: SyncSummary = { processed: 0, failed: 0, interrupted: false };
  // Reportes cuyo primer error bloquea las operaciones siguientes del mismo
  // reporte (dependen de él); otros reportes siguen sincronizando.
  const blockedReports = new Set<string>();
  const touchedReports = new Set<string>();

  try {
    const ops = await db.outbox
      .where("status")
      .anyOf("pending", "error", "inflight")
      .sortBy("seq");

    for (const op of ops) {
      if (blockedReports.has(op.reportId)) continue;
      touchedReports.add(op.reportId);

      await db.outbox.update(op.id, { status: "inflight" });

      let result: ActionResult;
      try {
        result = await runOp(op);
      } catch {
        // Error de red / redirect de auth: reintentar luego, cortar la corrida.
        await db.outbox.update(op.id, { status: "pending" });
        summary.interrupted = true;
        blockedReports.add(op.reportId);
        break;
      }

      if (result && result.ok === false) {
        // Error de validación/conflicto: es permanente para esta operación.
        await db.outbox.update(op.id, {
          status: "error",
          attempts: op.attempts + 1,
          lastError: result.message ?? "sync_error",
        });
        summary.failed += 1;
        blockedReports.add(op.reportId);
        continue;
      }

      await db.outbox.delete(op.id);
      summary.processed += 1;
    }

    // Reconciliar los reportes que quedaron sin operaciones pendientes.
    for (const reportId of touchedReports) {
      if (blockedReports.has(reportId)) continue;
      const remaining = await db.outbox
        .where("reportId")
        .equals(reportId)
        .filter((op) => op.status !== "done")
        .count();
      if (remaining === 0) {
        await reconcileReport(reportId);
      }
    }
  } finally {
    running = false;
  }

  return summary;
}

/**
 * Marca el reporte y sus certificados como sincronizados y refresca el bundle
 * desde el servidor para tomar desviaciones/hashes canónicos. El refresco es
 * best-effort: si falla la red, el estado local ya quedó consistente.
 */
async function reconcileReport(reportId: string): Promise<void> {
  const db = getDb();
  await db.transaction("rw", db.reports, db.certificates, async () => {
    const report = await db.reports.get(reportId);
    if (report) {
      report.syncState = "synced";
      await db.reports.put(report);
    }
    const certs = await db.certificates.where("reportId").equals(reportId).toArray();
    for (const cert of certs) {
      cert.syncState = "synced";
      cert.local = null;
      await db.certificates.put(cert);
    }
  });

  try {
    await downloadReportForOffline(reportId);
  } catch (error) {
    // 404 = el reporte ya no es editable (enviado o eliminado): limpiar la copia
    // local para no dejar datos huérfanos. Otros errores: el estado local ya es
    // consistente y el servidor recalculará al reabrir.
    if (error instanceof Error && error.message === "bundle_fetch_failed_404") {
      await db.transaction(
        "rw",
        db.reports,
        db.certificates,
        db.outbox,
        async () => {
          await db.reports.delete(reportId);
          await db.certificates.where("reportId").equals(reportId).delete();
          await db.outbox.where("reportId").equals(reportId).delete();
        }
      );
    }
  }
}

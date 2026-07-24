"use client";

import { useLiveQuery } from "dexie-react-hooks";
import type { CertificateType } from "@prisma/client";
import { getDb } from "@/lib/offline/db";
import type { StoredCertificate, StoredReport } from "@/lib/offline/db";
import type { OfflineReportBundle } from "@/lib/offline/bundle-types";
import { certificateHref } from "@/lib/certificates";

/**
 * Repositorio local-first. Descarga el bundle a Dexie y expone lecturas
 * reactivas. No pisa ediciones locales sin sincronizar (`dirty`/`syncing`).
 */

/**
 * Descarga un reporte para offline: trae el bundle, lo escribe en Dexie y
 * calienta la caché del Service Worker con las rutas de certificado (para que la
 * navegación funcione sin red).
 */
export async function downloadReportForOffline(reportId: string): Promise<void> {
  const res = await fetch(`/api/offline/reports/${reportId}/bundle`, {
    headers: { "cache-control": "no-store" },
  });
  if (!res.ok) {
    throw new Error(`bundle_fetch_failed_${res.status}`);
  }
  const bundle = (await res.json()) as OfflineReportBundle;
  await hydrateBundle(bundle);
  await warmRouteCache(bundle);
}

/** Escribe el bundle en Dexie preservando ediciones locales no sincronizadas. */
export async function hydrateBundle(bundle: OfflineReportBundle): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();

  await db.transaction("rw", db.reports, db.certificates, async () => {
    const existing = await db.reports.get(bundle.report.id);

    const storedReport: StoredReport = {
      id: bundle.report.id,
      meta: bundle.report,
      standards: bundle.standards,
      reportSignature:
        bundle.signatures.find((s) => s.certificateId === null) ?? null,
      downloadedAt: existing?.downloadedAt ?? now,
      fetchedAt: bundle.fetchedAt,
      serverUpdatedAt: bundle.report.updatedAt,
      syncState: existing?.syncState === "dirty" ? "dirty" : "synced",
    };
    await db.reports.put(storedReport);

    for (const certificate of bundle.certificates) {
      const current = await db.certificates.get(certificate.id);
      // No pisar ediciones locales pendientes de sincronizar.
      if (current && current.syncState !== "synced") continue;

      const stored: StoredCertificate = {
        id: certificate.id,
        reportId: bundle.report.id,
        data: certificate,
        signature:
          bundle.signatures.find((s) => s.certificateId === certificate.id) ??
          null,
        local: null,
        syncState: "synced",
        updatedAt: Date.now(),
      };
      await db.certificates.put(stored);
    }
  });
}

async function warmRouteCache(bundle: OfflineReportBundle): Promise<void> {
  if (typeof caches === "undefined") return;
  const urls = bundle.certificates.map((certificate) =>
    certificateHref(bundle.report.id, certificate.certificateType)
  );
  urls.push(`/reports/${bundle.report.id}/wizard/review`);
  await Promise.allSettled(
    urls.map((url) => fetch(url, { credentials: "same-origin" }))
  );
}

/** Vuelca el estado local de un reporte, para exportarlo ante un conflicto. */
export async function exportOfflineReport(reportId: string) {
  const db = getDb();
  const [report, certificates, outbox] = await Promise.all([
    db.reports.get(reportId),
    db.certificates.where("reportId").equals(reportId).toArray(),
    db.outbox.where("reportId").equals(reportId).toArray(),
  ]);
  return { exportedAt: new Date().toISOString(), report, certificates, outbox };
}

/** Elimina un reporte descargado y sus certificados locales. */
export async function removeOfflineReport(reportId: string): Promise<void> {
  const db = getDb();
  await db.transaction("rw", db.reports, db.certificates, db.outbox, async () => {
    await db.reports.delete(reportId);
    await db.certificates.where("reportId").equals(reportId).delete();
    await db.outbox.where("reportId").equals(reportId).delete();
  });
}

// ============ Lecturas reactivas ============

export function useOfflineReport(reportId: string): StoredReport | undefined {
  return useLiveQuery(() => getDb().reports.get(reportId), [reportId]);
}

export function useOfflineCertificate(
  reportId: string,
  certificateType: CertificateType
): StoredCertificate | undefined {
  return useLiveQuery(
    async () => {
      const certs = await getDb()
        .certificates.where("reportId")
        .equals(reportId)
        .toArray();
      return certs.find((c) => c.data.certificateType === certificateType);
    },
    [reportId, certificateType]
  );
}

/**
 * Certificado por id, con sentinela: `undefined` = cargando Dexie, `null` = no
 * descargado, objeto = encontrado. Permite distinguir "aún no sé" de "no existe".
 */
export function useStoredCertificate(
  certificateId: string
): StoredCertificate | null | undefined {
  return useLiveQuery(
    async () => (await getDb().certificates.get(certificateId)) ?? null,
    [certificateId]
  );
}

/** IDs de reportes descargados, para pintar el estado en listas. */
export function useDownloadedReportIds(): Set<string> {
  const ids = useLiveQuery(
    () => getDb().reports.toCollection().primaryKeys(),
    []
  );
  return new Set(ids ?? []);
}

/** Nº de operaciones pendientes de sync por reporte, para badges. */
export function usePendingOpCount(reportId: string): number {
  return (
    useLiveQuery(
      () =>
        getDb()
          .outbox.where("reportId")
          .equals(reportId)
          .filter((op) => op.status !== "done")
          .count(),
      [reportId]
    ) ?? 0
  );
}

/** Operaciones del outbox en estado de error (conflicto), para el panel. */
export function useErroredOps(reportId: string) {
  return (
    useLiveQuery(
      () =>
        getDb()
          .outbox.where("reportId")
          .equals(reportId)
          .filter((op) => op.status === "error")
          .toArray(),
      [reportId]
    ) ?? []
  );
}

export type ReportSyncState = {
  downloaded: boolean;
  pending: number;
  errored: number;
};

/** Estado de sincronización de un reporte, para el badge. */
export function useReportSyncState(reportId: string): ReportSyncState {
  return (
    useLiveQuery(
      async () => {
        const db = getDb();
        const [report, ops] = await Promise.all([
          db.reports.get(reportId),
          db.outbox.where("reportId").equals(reportId).toArray(),
        ]);
        return {
          downloaded: Boolean(report),
          pending: ops.filter((op) => op.status !== "done" && op.status !== "error")
            .length,
          errored: ops.filter((op) => op.status === "error").length,
        };
      },
      [reportId]
    ) ?? { downloaded: false, pending: 0, errored: 0 }
  );
}

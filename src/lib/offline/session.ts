import { getDb } from "@/lib/offline/db";

/**
 * Elimina datos autenticados guardados en el dispositivo. Además de IndexedDB,
 * limpia Cache Storage para que una navegación offline no pueda servir páginas
 * pertenecientes a la sesión anterior.
 */
export async function clearOfflineSessionData(): Promise<void> {
  const db = getDb();
  await db.transaction(
    "rw",
    db.reports,
    db.certificates,
    db.outbox,
    db.meta,
    async () => {
      await Promise.all([
        db.reports.clear(),
        db.certificates.clear(),
        db.outbox.clear(),
        db.meta.clear(),
      ]);
    }
  );

  if (typeof caches !== "undefined") {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
  }
}

/**
 * Aísla el almacenamiento offline por sesión. Si inicia sesión otra persona en
 * el mismo navegador, se descarta la copia anterior antes de registrar la nueva
 * identidad para evitar exposición o sincronización cruzada.
 */
export async function prepareOfflineSession(session: {
  userId: string;
  role: string;
  name: string;
  title: string;
  locale: string;
}): Promise<void> {
  const db = getDb();
  const current = await db.meta.get("session");
  if (current && current.userId !== session.userId) {
    await clearOfflineSessionData();
  }

  await getDb().meta.put({
    key: "session",
    ...session,
    seenAt: Date.now(),
  });
}

/** Cantidad de operaciones locales que se perderían al cerrar sesión. */
export async function pendingOfflineOperationCount(): Promise<number> {
  return getDb()
    .outbox.filter((operation) => operation.status !== "done")
    .count();
}

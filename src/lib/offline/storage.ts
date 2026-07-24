/**
 * Utilidades de almacenamiento persistente. Sin `persist()`, el navegador puede
 * desalojar IndexedDB bajo presión de espacio y perder capturas offline sin
 * sincronizar. Con él, los datos quedan protegidos hasta que el usuario los borre.
 */

export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) {
    return false;
  }
  if (navigator.storage.persisted && (await navigator.storage.persisted())) {
    return true;
  }
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export type StorageEstimate = {
  usage: number;
  quota: number;
  /** Fracción usada [0..1]. 0 si no se conoce la cuota. */
  ratio: number;
};

export async function getStorageEstimate(): Promise<StorageEstimate | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
    return null;
  }
  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return { usage, quota, ratio: quota ? usage / quota : 0 };
  } catch {
    return null;
  }
}

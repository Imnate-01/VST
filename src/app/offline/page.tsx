import type { Metadata } from "next";
import { OfflineFallback } from "@/components/offline/offline-fallback";

export const metadata: Metadata = {
  title: "Sin conexión — VST Calibration",
};

/**
 * Fallback de navegación cuando el SW no tiene la página en caché y no hay red.
 * Es una ruta pública (fuera de (app)) para que no dependa de la sesión ni de
 * consultas a la base de datos. El contenido se traduce en cliente.
 */
export default function OfflinePage() {
  return <OfflineFallback />;
}

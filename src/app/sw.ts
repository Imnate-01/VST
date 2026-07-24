import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    // Inyectado por @serwist/next en build: lista de precache del app shell.
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  // defaultCache: NetworkFirst para navegaciones/RSC, StaleWhileRevalidate para
  // estáticos, CacheFirst para imágenes. Suficiente para el app shell.
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        // Si una navegación falla sin caché, mostramos la página offline.
        url: "/offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();

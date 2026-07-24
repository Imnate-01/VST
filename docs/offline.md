# Modo offline (PWA)

La app es instalable y permite capturar calibraciones **sin conexión** en planta,
sincronizando al reconectar. Este documento resume la arquitectura, los límites
conocidos y cómo probarla.

## Modelo mental

1. **Preparación (con conexión).** El ingeniero crea el reporte y completa Info /
   Checklist / Instrumentos. Luego marca **"Disponible offline"** en el header del
   wizard: se descarga el _bundle_ del reporte a IndexedDB y se calienta la caché
   del Service Worker con las rutas de certificado.
2. **Campo (sin conexión).** Abre el reporte descargado y captura mediciones,
   lecturas, verificación y firmas. Todo se guarda **localmente** (Dexie) y se
   encola en un _outbox_. La UI muestra "Guardado local · pendiente de sincronizar".
3. **Reconexión.** Al volver la red (o al enfocar la pestaña / cada 60 s), el
   _sync manager_ reproduce el outbox contra los Server Actions en orden y
   reconcilia el estado local con el servidor.
4. **Envío final.** Generar el PDF definitivo es **online-only**: el botón de
   envío se bloquea sin conexión o con cambios pendientes de sincronizar.

## Piezas

| Área | Archivo |
|---|---|
| Service worker (Serwist) | `src/app/sw.ts`, `next.config.mjs` |
| Manifest / iconos | `src/app/manifest.ts`, `public/icon-*.png` |
| Estado de red / banner / instalación | `src/components/offline/*` |
| Store local (IndexedDB) | `src/lib/offline/db.ts` |
| Bundle (DTO + endpoint + ensamblador) | `src/lib/offline/bundle-types.ts`, `src/app/api/offline/reports/[id]/bundle/route.ts`, `src/server/services/offline-bundle.ts` |
| Repositorio (hidratar + hooks) | `src/lib/offline/repository.ts` |
| Guardado local-first | `src/lib/offline/save.ts` |
| Motor de cálculo isomórfico | `src/shared/domain/measurement-status.ts` |
| Sync manager | `src/lib/offline/sync.ts`, `src/components/offline/offline-sync.tsx` |
| Almacenamiento persistente | `src/lib/offline/storage.ts` |

## Decisiones clave

- **Lecturas offline por caché del SW.** Las páginas del wizard son RSC; no se
  reconvierten a islands. Al descargar se prefetchean sus rutas para que la caché
  NetworkFirst del SW las sirva sin red. Las escrituras y la hidratación de
  valores locales van por Dexia (`useStoredCertificate`).
- **Motor de cálculo compartido.** El Pass/Fail y las desviaciones se calculan en
  el navegador con el mismo código que usa el servidor
  (`src/shared/domain/measurement-status.ts`), así el estado offline coincide con
  el que recalcula el servidor al sincronizar.
- **Outbox idempotente.** Cada operación mapea 1:1 a un Server Action upsert
  idempotente, ordenado por `seq` (mediciones antes que firmas). Reproducir es
  seguro.
- **Sync foreground.** No se usa Background Sync del SW (reproducir Server Actions
  desde el SW es frágil). El sync corre en primer plano al reconectar con la app
  abierta, que es el escenario real.

## Límites conocidos

- **El primer login requiere conexión.** No se validan credenciales offline. La
  sesión JWT dura 30 días para cubrir jornadas de campo.
- **El envío final (PDF + Blob) es online.** Se bloquea offline o con cola pendiente.
- **Conflictos** (reporte ya enviado o ajeno): la operación queda en `error`, se
  muestra el panel de conflicto y **no se destruye la copia local**; el usuario
  puede exportarla (JSON) antes de descartarla.
- **Aislamiento de sesión.** Al cerrar sesión se eliminan IndexedDB y las cachés
  autenticadas del dispositivo. Si hay cambios pendientes, la app pide
  confirmación para evitar descartarlos accidentalmente. Un cambio de usuario
  también limpia la copia anterior para impedir sincronización o lectura cruzada.

## Cómo probar (E2E manual)

1. `npm run dev` e inicia sesión.
2. En un reporte en borrador, marca **"Disponible offline"**. Verifica en DevTools
   → Application → IndexedDB → `vst-offline` que el reporte y sus certificados
   están guardados.
3. DevTools → Network → **Offline**. Abre el reporte, completa un certificado y
   fírmalo. Debe aparecer "Guardado local · pendiente de sincronizar" y el badge
   de sync con pendientes.
4. Vuelve **Online**. El sync sube todo; el badge pasa a "Sincronizado". Verifica
   en Postgres (`npm run db:studio`) que las mediciones y la firma coinciden, y que
   las desviaciones calculadas en cliente igualan las del servidor.
5. Recarga en modo avión para confirmar que el shell arranca desde el SW.

> Nota de entorno: si el proyecto vive en OneDrive, la caché de webpack de `.next`
> puede corromperse en dev (errores JSON espurios). Solución: `rm -rf .next` y
> reiniciar. No es un defecto del código.

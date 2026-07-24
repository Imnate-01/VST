/**
 * En modo offline solo es seguro navegar dentro del wizard del reporte actual:
 * esas son las rutas que se calientan al descargarlo. Las demás secciones
 * requieren respuestas RSC del servidor y terminarían en el fallback offline.
 */
export function isOfflineNavigationAllowed(
  currentPathname: string,
  targetPathname: string
): boolean {
  if (currentPathname === targetPathname) return true;

  const match = currentPathname.match(/^\/reports\/([^/]+)\/wizard(?:\/|$)/);
  if (!match?.[1]) return false;

  return targetPathname.startsWith(`/reports/${match[1]}/wizard/`);
}

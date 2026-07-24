import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { getOfflineReportBundle } from "@/server/services/offline-bundle";

/**
 * Devuelve la foto completa de un reporte para trabajar offline. Autenticado y
 * limitado a borradores editables por el usuario. El cliente lo guarda en Dexie.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await requireAuth();

  const bundle = await getOfflineReportBundle(id, {
    id: session.user.id,
    role: session.user.role,
  });

  if (!bundle) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // No cachear en el navegador HTTP: el SW/Dexie gestionan la persistencia.
  return NextResponse.json(bundle, {
    headers: { "Cache-Control": "no-store" },
  });
}

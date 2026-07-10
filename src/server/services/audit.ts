import { prisma } from "../db";
import { headers } from "next/headers";

type AuditParams = {
  entityType: string;
  entityId: string;
  action: string;
  userId: string;
  changes?: Record<string, unknown>;
};

/**
 * Registra un evento en el audit log.
 * Nunca lanza excepción hacia arriba: si falla el log, no debe romper la operación de negocio.
 */
export async function logAudit(params: AuditParams): Promise<void> {
  try {
    const h = await headers();
    const ipAddress =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      h.get("x-real-ip") ??
      null;
    const userAgent = h.get("user-agent") ?? null;

    await prisma.auditLog.create({
      data: {
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        userId: params.userId,
        changes: params.changes ? (params.changes as object) : undefined,
        ipAddress,
        userAgent,
      },
    });
  } catch (err) {
    console.error("[audit log failure]", err);
  }
}

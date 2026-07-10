import { createSafeActionClient } from "next-safe-action";
import { auth } from "./auth";

/**
 * Cliente base sin auth. Solo para acciones públicas (raras).
 */
export const actionClient = createSafeActionClient({
  handleServerError(e) {
    console.error("[Action error]", e);
    if (e instanceof Error) return e.message;
    return "Ocurrió un error inesperado";
  },
});

/**
 * Cliente que exige sesión autenticada.
 * Inyecta ctx.user con { id, email, name, role, title }.
 */
export const authAction = actionClient.use(async ({ next }) => {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return next({ ctx: { user: session.user } });
});

/**
 * Cliente que exige rol ADMIN.
 */
export const adminAction = authAction.use(async ({ next, ctx }) => {
  if (ctx.user.role !== "ADMIN") {
    throw new Error("Forbidden: admin required");
  }
  return next({ ctx });
});

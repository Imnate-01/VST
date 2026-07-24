import type { NextAuthConfig } from "next-auth";

/**
 * Configuración compatible con Edge. El middleware importa únicamente este
 * archivo para no incluir Prisma ni bcrypt en su bundle.
 */
export const authConfig = {
  // 30 días: una jornada de campo sin conexión no debe expirar la sesión y
  // dejar al técnico fuera al reabrir la app instalada. El primer login sigue
  // requiriendo conexión.
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: {
    signIn: "/login",
  },
  providers: [],
} satisfies NextAuthConfig;

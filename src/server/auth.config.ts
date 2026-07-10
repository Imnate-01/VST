import type { NextAuthConfig } from "next-auth";

/**
 * Configuración compatible con Edge. El middleware importa únicamente este
 * archivo para no incluir Prisma ni bcrypt en su bundle.
 */
export const authConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
} satisfies NextAuthConfig;

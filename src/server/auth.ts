import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "./db";
import { authConfig } from "./auth.config";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "ENGINEER" | "ADMIN";
      title: string;
    } & DefaultSession["user"];
  }

  interface User {
    role?: "ENGINEER" | "ADMIN";
    title?: string;
  }
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        });

        if (!user || !user.active) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          title: user.title,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.title = user.title;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.role = token.role as "ENGINEER" | "ADMIN";
        session.user.title = token.title as string;
      }
      return session;
    },
  },
});

/**
 * Helper para usar dentro de Server Actions y RSC.
 *
 * Con `strategy: "jwt"` el token lleva id, role y title firmados y no se vuelve
 * a consultar la base. Eso significa que un usuario borrado o desactivado
 * conservaría una sesión válida hasta que expire el token, y que degradar a un
 * ADMIN no le quitaría permisos. Por eso acá se revalida contra la base en cada
 * request y se usan los valores frescos, no los del token.
 *
 * Si el usuario ya no existe o está inactivo, redirige a /login. Los `catch` de
 * las Server Actions deben usar `unstable_rethrow` para no tragarse el redirect.
 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, role: true, title: true, active: true },
  });

  if (!user || !user.active) {
    redirect("/login");
  }

  return {
    ...session,
    user: {
      ...session.user,
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      title: user.title,
    },
  };
}

export async function requireAdmin() {
  const session = await requireAuth();
  if (session.user.role !== "ADMIN") {
    throw new Error("Forbidden: admin required");
  }
  return session;
}

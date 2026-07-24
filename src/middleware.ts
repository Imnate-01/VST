import NextAuth from "next-auth";
import { authConfig } from "@/server/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  const isPublicRoute =
    pathname === "/login" ||
    pathname === "/offline" ||
    pathname.startsWith("/api/auth");

  if (!isLoggedIn && !isPublicRoute) {
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  // Se excluyen assets estáticos y los archivos de la PWA (manifest y service
  // worker) para que sean accesibles sin sesión; de lo contrario el middleware
  // los redirige a /login y el navegador no puede instalar ni registrar el SW.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|swe-worker-.*|workbox-.*|.*\\.(?:png|jpg|jpeg|svg|gif|webp)$).*)",
  ],
};

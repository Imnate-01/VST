import { defineConfig } from "@prisma/config";
import { config } from "dotenv";

config();

// Vercel/Neon expone nombres distintos según el entorno. Los previews no
// siempre reciben DIRECT_URL, pero sí la conexión no agrupada de la integración.
// DATABASE_URL queda como último recurso para desarrollo local.
if (!process.env.DIRECT_URL) {
  const directUrl =
    process.env.DATABASE_URL_UNPOOLED ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.DATABASE_URL;

  if (directUrl) process.env.DIRECT_URL = directUrl;
}

export default defineConfig({});

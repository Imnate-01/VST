import { defineConfig } from "@prisma/config";
import { config } from "dotenv";

if (!process.env.VERCEL) config();

const isVercelPreview =
  process.env.VERCEL_ENV === "preview" ||
  process.env.VERCEL_TARGET_ENV === "preview";

// Los comandos de migración prefieren la conexión no agrupada de Neon. Vercel
// Preview no recibe credenciales de base de datos en este proyecto: para
// generar el cliente durante el build basta una URL sintácticamente válida.
const migrationUrl =
  process.env.DIRECT_URL ??
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.DATABASE_URL ??
  (isVercelPreview
    ? "postgresql://preview:preview@127.0.0.1:5432/preview"
    : undefined);

export default migrationUrl
  ? defineConfig({
      engine: "classic",
      datasource: { url: migrationUrl },
    })
  : defineConfig({});

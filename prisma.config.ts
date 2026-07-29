import { defineConfig } from "@prisma/config";
import { config } from "dotenv";

config();

// Los comandos de migración prefieren la conexión no agrupada de Neon. Vercel
// Preview no siempre expone DIRECT_URL, así que se cae a la URL disponible.
const migrationUrl =
  process.env.DIRECT_URL ??
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.DATABASE_URL;

export default migrationUrl
  ? defineConfig({
      engine: "classic",
      datasource: { url: migrationUrl },
    })
  : defineConfig({});

import { spawnSync } from "node:child_process";

const isVercelPreview =
  process.env.VERCEL_ENV === "preview" ||
  process.env.VERCEL_TARGET_ENV === "preview";

if (isVercelPreview) {
  console.log("Skipping database migrations for Vercel Preview.");
  process.exit(0);
}

const result = spawnSync(
  process.execPath,
  ["./node_modules/prisma/build/index.js", "migrate", "deploy"],
  {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  }
);

process.exit(result.status ?? 1);

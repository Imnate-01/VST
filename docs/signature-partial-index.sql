-- Invariante: a lo sumo una firma ACTIVA por certificado, y a lo sumo una
-- firma activa a nivel reporte (certificateId IS NULL), por firmante y rol.
--
-- Prisma no puede expresar índices únicos parciales en schema.prisma, así que
-- estos índices no se crean con `prisma db push`. Hoy la unicidad se garantiza
-- en la transacción de `signCertificate` / `signReport`, que revoca la firma
-- anterior antes de crear la nueva. Eso deja una ventana de carrera si dos
-- requests firman el mismo certificado a la vez.
--
-- Aplicar cuando se inicialice prisma/migrations (ver backlog), o a mano con:
--   npx prisma db execute --file docs/signature-partial-index.sql --schema prisma/schema.prisma

CREATE UNIQUE INDEX IF NOT EXISTS "Signature_active_certificate_key"
  ON "Signature" ("certificateId", "signerUserId", "signerRole")
  WHERE "revoked" = false AND "certificateId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Signature_active_report_key"
  ON "Signature" ("reportId", "signerUserId", "signerRole")
  WHERE "revoked" = false AND "certificateId" IS NULL;

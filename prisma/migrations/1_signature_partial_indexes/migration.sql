-- Invariante: a lo sumo una firma ACTIVA por certificado, y a lo sumo una firma
-- activa a nivel reporte (certificateId IS NULL), por firmante y rol.
--
-- Prisma no puede expresar índices únicos parciales en schema.prisma, por eso
-- se crean acá como SQL crudo. Ver docs/signature-partial-index.sql.

CREATE UNIQUE INDEX IF NOT EXISTS "Signature_active_certificate_key"
  ON "Signature" ("certificateId", "signerUserId", "signerRole")
  WHERE "revoked" = false AND "certificateId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Signature_active_report_key"
  ON "Signature" ("reportId", "signerUserId", "signerRole")
  WHERE "revoked" = false AND "certificateId" IS NULL;

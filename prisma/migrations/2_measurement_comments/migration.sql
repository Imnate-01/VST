-- Move section-level comments to the target/sensor records that they describe.
ALTER TABLE "CertificateMeasurement" ADD COLUMN "notes" TEXT;
ALTER TABLE "VerificationRow" ADD COLUMN "notes" TEXT;

-- Preserve existing comments by copying them to every existing target in the
-- section. Certificate.notes remains for historical compatibility, but new
-- captures no longer write or print it.
UPDATE "CertificateMeasurement" AS measurement
SET "notes" = certificate."notes"
FROM "Certificate" AS certificate
WHERE measurement."certificateId" = certificate."id"
  AND certificate."notes" IS NOT NULL;

UPDATE "VerificationRow" AS verification
SET "notes" = certificate."notes"
FROM "Certificate" AS certificate
WHERE verification."certificateId" = certificate."id"
  AND certificate."notes" IS NOT NULL;

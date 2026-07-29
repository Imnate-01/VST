CREATE TYPE "StandardCertificationStatus" AS ENUM (
  'CERTIFIED',
  'NOT_APPLICABLE',
  'PENDING'
);

ALTER TABLE "StandardInstrument"
  ADD COLUMN "certificationStatus" "StandardCertificationStatus" NOT NULL DEFAULT 'CERTIFIED',
  ALTER COLUMN "calibrationCertNumber" DROP NOT NULL,
  ALTER COLUMN "calibrationDate" DROP NOT NULL,
  ALTER COLUMN "calibrationExpiresAt" DROP NOT NULL;

ALTER TABLE "ReportStandard"
  ADD COLUMN "certificationStatusSnapshot" "StandardCertificationStatus" NOT NULL DEFAULT 'CERTIFIED',
  ALTER COLUMN "certNumberSnapshot" DROP NOT NULL,
  ALTER COLUMN "calDateSnapshot" DROP NOT NULL,
  ALTER COLUMN "calExpiresAtSnapshot" DROP NOT NULL;

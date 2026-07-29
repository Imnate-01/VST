-- AlterTable
ALTER TABLE "MeasurementPoint" ADD COLUMN     "notApplicable" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CertificateStandard" (
    "id" TEXT NOT NULL,
    "certificateId" TEXT NOT NULL,
    "reportStandardId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CertificateStandard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CertificateStandard_reportStandardId_idx" ON "CertificateStandard"("reportStandardId");

-- CreateIndex
CREATE UNIQUE INDEX "CertificateStandard_certificateId_reportStandardId_key" ON "CertificateStandard"("certificateId", "reportStandardId");

-- AddForeignKey
ALTER TABLE "CertificateStandard" ADD CONSTRAINT "CertificateStandard_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificateStandard" ADD CONSTRAINT "CertificateStandard_reportStandardId_fkey" FOREIGN KEY ("reportStandardId") REFERENCES "ReportStandard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

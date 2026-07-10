-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ENGINEER', 'ADMIN');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('RTD', 'PS', 'FM', 'HS', 'US', 'MOT');

-- CreateEnum
CREATE TYPE "CertificateType" AS ENUM ('TEMPERATURE', 'CHAMBER_VST_AIR_FLOW', 'CHAMBER_STERILE_AIR_FLOW', 'PRESSURE', 'VACUUM_TANK_PRESSURE', 'EOL_FLOW', 'VAC_FLOW', 'HUMIDITY', 'ULTRASONIC', 'METERING_PUMP_CHAMBER', 'METERING_PUMP_TUNNEL', 'EXHAUST', 'VACUUM_PRESSURE');

-- CreateEnum
CREATE TYPE "CertificateLayout" AS ENUM ('RANGE', 'SETPOINT', 'SINGLE_POINT', 'TEST_READINGS', 'VERIFICATION');

-- CreateEnum
CREATE TYPE "PointKind" AS ENUM ('LOW', 'HIGH', 'SINGLE');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "CertificateStatus" AS ENUM ('PENDING', 'PASS', 'FAIL', 'MIXED');

-- CreateEnum
CREATE TYPE "MeasurementStatus" AS ENUM ('PENDING', 'PASS', 'FAIL', 'NA');

-- CreateEnum
CREATE TYPE "SignerRole" AS ENUM ('PREPARER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'ENGINEER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FillerModel" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "FillerModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Filler" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientAddress" TEXT NOT NULL,
    "clientCity" TEXT NOT NULL,
    "clientState" TEXT NOT NULL,
    "clientZip" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Filler_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceCatalog" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "tagNumber" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "deviceType" "DeviceType" NOT NULL,
    "toleranceValue" DECIMAL(10,4) NOT NULL,
    "toleranceUnit" TEXT NOT NULL,
    "toleranceIsPercent" BOOLEAN NOT NULL DEFAULT false,
    "certificateTypes" "CertificateType"[],
    "displayOrder" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DeviceCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StandardInstrument" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "calibrationCertNumber" TEXT NOT NULL,
    "calibrationDate" TIMESTAMP(3) NOT NULL,
    "calibrationExpiresAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "StandardInstrument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reportNumber" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL DEFAULT 0,
    "fillerId" TEXT NOT NULL,
    "serviceDate" TIMESTAMP(3) NOT NULL,
    "preparedById" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',
    "observations" TEXT,
    "preparedBySnapshot" JSONB,
    "clientSnapshot" JSONB,
    "fillerSnapshot" JSONB,
    "submittedAt" TIMESTAMP(3),
    "pdfUrl" TEXT,
    "pdfSha256" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportDeviceSelection" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "deviceCatalogId" TEXT NOT NULL,
    "included" BOOLEAN NOT NULL DEFAULT true,
    "exclusionReason" TEXT,
    "tagNumberSnapshot" TEXT NOT NULL,
    "descriptionSnapshot" TEXT NOT NULL,
    "toleranceValueSnapshot" DECIMAL(10,4) NOT NULL,
    "toleranceUnitSnapshot" TEXT NOT NULL,
    "toleranceIsPercentSnapshot" BOOLEAN NOT NULL,
    "certificateTypesSnapshot" "CertificateType"[],
    "displayOrderSnapshot" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReportDeviceSelection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportStandard" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "standardInstrumentId" TEXT NOT NULL,
    "descriptionSnapshot" TEXT NOT NULL,
    "manufacturerSnapshot" TEXT NOT NULL,
    "modelSnapshot" TEXT NOT NULL,
    "serialSnapshot" TEXT NOT NULL,
    "certNumberSnapshot" TEXT NOT NULL,
    "calDateSnapshot" TIMESTAMP(3) NOT NULL,
    "calExpiresAtSnapshot" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportStandard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "certificateType" "CertificateType" NOT NULL,
    "layout" "CertificateLayout" NOT NULL,
    "primaryStandardId" TEXT NOT NULL,
    "params" JSONB,
    "overallStatus" "CertificateStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertificateMeasurement" (
    "id" TEXT NOT NULL,
    "certificateId" TEXT NOT NULL,
    "deviceSelectionId" TEXT NOT NULL,
    "correctionMethod" TEXT,
    "requiredAdjustment" BOOLEAN NOT NULL DEFAULT false,
    "status" "MeasurementStatus" NOT NULL DEFAULT 'PENDING',
    "statusReason" TEXT,

    CONSTRAINT "CertificateMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeasurementPoint" (
    "id" TEXT NOT NULL,
    "measurementId" TEXT NOT NULL,
    "kind" "PointKind" NOT NULL,
    "conditionValue" DECIMAL(10,4),
    "targetNominal" DECIMAL(10,4),
    "asFoundReference" DECIMAL(10,4),
    "asFoundReading" DECIMAL(10,4),
    "asFoundDeviation" DECIMAL(10,4),
    "asFoundInTolerance" BOOLEAN,
    "asLeftReference" DECIMAL(10,4),
    "asLeftReading" DECIMAL(10,4),
    "asLeftDeviation" DECIMAL(10,4),
    "asLeftInTolerance" BOOLEAN,

    CONSTRAINT "MeasurementPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestReading" (
    "id" TEXT NOT NULL,
    "measurementId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "value" DECIMAL(10,4),
    "target" DECIMAL(10,4),
    "deviation" DECIMAL(10,4),
    "inTolerance" BOOLEAN,

    CONSTRAINT "TestReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationRow" (
    "id" TEXT NOT NULL,
    "certificateId" TEXT NOT NULL,
    "motorTag" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rowLabel" TEXT NOT NULL,
    "scfm" DECIMAL(10,4),
    "driveFrequencyHz" DECIMAL(10,4),
    "notApplicable" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL,

    CONSTRAINT "VerificationRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signature" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "signerUserId" TEXT NOT NULL,
    "signerRole" "SignerRole" NOT NULL,
    "certificateId" TEXT,
    "signatureImageUrl" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Signature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "changes" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "FillerModel_code_key" ON "FillerModel"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Filler_modelId_serialNumber_key" ON "Filler"("modelId", "serialNumber");

-- CreateIndex
CREATE INDEX "DeviceCatalog_modelId_idx" ON "DeviceCatalog"("modelId");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceCatalog_modelId_tagNumber_key" ON "DeviceCatalog"("modelId", "tagNumber");

-- CreateIndex
CREATE INDEX "StandardInstrument_active_calibrationExpiresAt_idx" ON "StandardInstrument"("active", "calibrationExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Report_reportNumber_key" ON "Report"("reportNumber");

-- CreateIndex
CREATE INDEX "Report_preparedById_status_idx" ON "Report"("preparedById", "status");

-- CreateIndex
CREATE INDEX "Report_status_serviceDate_idx" ON "Report"("status", "serviceDate");

-- CreateIndex
CREATE UNIQUE INDEX "ReportDeviceSelection_reportId_deviceCatalogId_key" ON "ReportDeviceSelection"("reportId", "deviceCatalogId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportStandard_reportId_standardInstrumentId_key" ON "ReportStandard"("reportId", "standardInstrumentId");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_reportId_certificateType_key" ON "Certificate"("reportId", "certificateType");

-- CreateIndex
CREATE UNIQUE INDEX "CertificateMeasurement_certificateId_deviceSelectionId_key" ON "CertificateMeasurement"("certificateId", "deviceSelectionId");

-- CreateIndex
CREATE UNIQUE INDEX "MeasurementPoint_measurementId_kind_key" ON "MeasurementPoint"("measurementId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "TestReading_measurementId_sequence_key" ON "TestReading"("measurementId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationRow_certificateId_motorTag_rowLabel_key" ON "VerificationRow"("certificateId", "motorTag", "rowLabel");

-- CreateIndex
CREATE INDEX "Signature_reportId_revoked_idx" ON "Signature"("reportId", "revoked");

-- CreateIndex
CREATE INDEX "Signature_certificateId_revoked_idx" ON "Signature"("certificateId", "revoked");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_occurredAt_idx" ON "AuditLog"("entityType", "entityId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_occurredAt_idx" ON "AuditLog"("userId", "occurredAt");

-- AddForeignKey
ALTER TABLE "Filler" ADD CONSTRAINT "Filler_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "FillerModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceCatalog" ADD CONSTRAINT "DeviceCatalog_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "FillerModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_fillerId_fkey" FOREIGN KEY ("fillerId") REFERENCES "Filler"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_preparedById_fkey" FOREIGN KEY ("preparedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportDeviceSelection" ADD CONSTRAINT "ReportDeviceSelection_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportDeviceSelection" ADD CONSTRAINT "ReportDeviceSelection_deviceCatalogId_fkey" FOREIGN KEY ("deviceCatalogId") REFERENCES "DeviceCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportStandard" ADD CONSTRAINT "ReportStandard_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportStandard" ADD CONSTRAINT "ReportStandard_standardInstrumentId_fkey" FOREIGN KEY ("standardInstrumentId") REFERENCES "StandardInstrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_primaryStandardId_fkey" FOREIGN KEY ("primaryStandardId") REFERENCES "ReportStandard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificateMeasurement" ADD CONSTRAINT "CertificateMeasurement_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificateMeasurement" ADD CONSTRAINT "CertificateMeasurement_deviceSelectionId_fkey" FOREIGN KEY ("deviceSelectionId") REFERENCES "ReportDeviceSelection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeasurementPoint" ADD CONSTRAINT "MeasurementPoint_measurementId_fkey" FOREIGN KEY ("measurementId") REFERENCES "CertificateMeasurement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestReading" ADD CONSTRAINT "TestReading_measurementId_fkey" FOREIGN KEY ("measurementId") REFERENCES "CertificateMeasurement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationRow" ADD CONSTRAINT "VerificationRow_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signature" ADD CONSTRAINT "Signature_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signature" ADD CONSTRAINT "Signature_signerUserId_fkey" FOREIGN KEY ("signerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signature" ADD CONSTRAINT "Signature_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

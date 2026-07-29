-- El tipo de dispositivo se imprime en el checklist del reporte. Hasta ahora se
-- leía del catálogo vivo, así que editar el catálogo cambiaba lo que mostraba un
-- reporte ya firmado. Se congela como los demás snapshots.
--
-- La columna se agrega nullable, se rellena desde el catálogo y recién después
-- se marca NOT NULL: la tabla ya tiene filas.

ALTER TABLE "ReportDeviceSelection" ADD COLUMN "deviceTypeSnapshot" "DeviceType";

UPDATE "ReportDeviceSelection" AS rds
SET "deviceTypeSnapshot" = dc."deviceType"
FROM "DeviceCatalog" AS dc
WHERE dc."id" = rds."deviceCatalogId";

ALTER TABLE "ReportDeviceSelection"
  ALTER COLUMN "deviceTypeSnapshot" SET NOT NULL;

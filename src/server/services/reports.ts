import {
  CertificateType,
  ReportStatus,
  type Prisma,
  type UserRole,
} from "@prisma/client";
import { prisma } from "@/server/db";
import { generateReportNumber } from "@/server/domain/report-number";
import { logAudit } from "@/server/services/audit";
import {
  getCertificateLayout,
  implementedCertificateTypes,
} from "@/lib/certificates";

type Actor = {
  id: string;
  role: UserRole;
};

const implementedTypes = [...implementedCertificateTypes];

function isImplementedType(type: CertificateType): boolean {
  return implementedTypes.includes(type);
}

/**
 * Tipos de certificado requeridos por los dispositivos incluidos.
 * Un dispositivo puede pertenecer a más de un certificado (ej. Metering Pump),
 * por eso se aplana el array de snapshots.
 */
function requiredCertificateTypes(
  selections: Array<{ certificateTypesSnapshot: CertificateType[] }>
): CertificateType[] {
  const types = new Set(
    selections.flatMap((selection) => selection.certificateTypesSnapshot)
  );

  return implementedTypes.filter((type) => types.has(type));
}

function dateOnlyUtc(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

function parseDateInput(value: string): Date {
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if (!year || !month || !day) {
    throw new Error("Fecha de servicio inválida");
  }

  return new Date(Date.UTC(year, month - 1, day));
}

async function getAvailableReportNumber(baseReportNumber: string, excludeReportId?: string) {
  let candidate = baseReportNumber;
  let suffix = 2;

  while (
    await prisma.report.findFirst({
      where: {
        reportNumber: candidate,
        ...(excludeReportId ? { id: { not: excludeReportId } } : {}),
      },
      select: { id: true },
    })
  ) {
    candidate = `${baseReportNumber}_${suffix}`;
    suffix += 1;
  }

  return candidate;
}

async function getEditableReport(reportId: string, actor: Actor) {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: {
      filler: { include: { model: true } },
      preparedBy: { select: { id: true, name: true, email: true } },
    },
  });

  if (!report) return null;
  if (report.status !== ReportStatus.DRAFT) return null;
  if (actor.role !== "ADMIN" && report.preparedById !== actor.id) return null;

  return report;
}

export async function createDraftReport(userId: string) {
  const filler = await prisma.filler.findFirst({
    where: { active: true, model: { active: true } },
    orderBy: [{ clientName: "asc" }, { serialNumber: "asc" }],
    include: { model: true },
  });

  if (!filler) {
    throw new Error("No hay Fillers activos disponibles para crear un reporte.");
  }

  const serviceDate = dateOnlyUtc(new Date());
  const revisionNumber = 0;
  const baseReportNumber = generateReportNumber({
    clientName: filler.clientName,
    serviceDate,
    fillerModelCode: filler.model.code,
    revisionNumber,
  });
  const reportNumber = await getAvailableReportNumber(baseReportNumber);

  const report = await prisma.report.create({
    data: {
      reportNumber,
      revisionNumber,
      status: ReportStatus.DRAFT,
      preparedById: userId,
      serviceDate,
      fillerId: filler.id,
    },
  });

  await logAudit({
    entityType: "Report",
    entityId: report.id,
    action: "create",
    userId,
    changes: {
      reportNumber: report.reportNumber,
      status: report.status,
      fillerId: report.fillerId,
    },
  });

  return report;
}

export async function getReportForWizard(reportId: string, actor: Actor) {
  const report = await getEditableReport(reportId, actor);
  if (!report) return null;

  const fillers = await prisma.filler.findMany({
    where: { active: true, model: { active: true } },
    orderBy: [{ clientName: "asc" }, { serialNumber: "asc" }],
    include: { model: true },
  });

  return { report, fillers };
}

export async function updateReportBasicInfo(
  actor: Actor,
  input: {
    reportId: string;
    serviceDate: string;
    fillerId: string;
    observations?: string;
  }
) {
  const report = await getEditableReport(input.reportId, actor);
  if (!report) {
    throw new Error("Reporte no encontrado o no editable.");
  }

  const filler = await prisma.filler.findFirst({
    where: { id: input.fillerId, active: true, model: { active: true } },
    include: { model: true },
  });

  if (!filler) {
    throw new Error("El Filler seleccionado no está activo o no existe.");
  }

  const serviceDate = parseDateInput(input.serviceDate);
  const baseReportNumber = generateReportNumber({
    clientName: filler.clientName,
    serviceDate,
    fillerModelCode: filler.model.code,
    revisionNumber: report.revisionNumber,
  });
  const reportNumber = await getAvailableReportNumber(baseReportNumber, report.id);
  const fillerChanged = report.fillerId !== filler.id;

  const updated = await prisma.$transaction(async (tx) => {
    if (fillerChanged) {
      await tx.certificate.deleteMany({ where: { reportId: report.id } });
      await tx.reportStandard.deleteMany({ where: { reportId: report.id } });
      await tx.reportDeviceSelection.deleteMany({ where: { reportId: report.id } });
    }

    return tx.report.update({
      where: { id: report.id },
      data: {
        serviceDate,
        fillerId: filler.id,
        observations: input.observations?.trim() || null,
        reportNumber,
      },
    });
  });

  await logAudit({
    entityType: "Report",
    entityId: report.id,
    action: "update_info",
    userId: actor.id,
    changes: {
      serviceDate: input.serviceDate,
      fillerId: filler.id,
      observations: input.observations?.trim() || null,
      resetSelections: fillerChanged,
    },
  });

  return updated;
}

export async function getDeviceWizardData(reportId: string, actor: Actor) {
  const report = await getEditableReport(reportId, actor);
  if (!report) return null;

  const [devices, selections] = await Promise.all([
    prisma.deviceCatalog.findMany({
      where: {
        active: true,
        modelId: report.filler.modelId,
        certificateTypes: { hasSome: implementedTypes },
      },
      orderBy: [{ displayOrder: "asc" }, { tagNumber: "asc" }],
    }),
    prisma.reportDeviceSelection.findMany({
      where: { reportId },
    }),
  ]);

  return { report, devices, selections };
}

export async function syncReportDeviceSelections(
  actor: Actor,
  input: {
    reportId: string;
    selections: Array<{
      deviceCatalogId: string;
      included: boolean;
      exclusionReason?: string;
    }>;
  }
) {
  const report = await getEditableReport(input.reportId, actor);
  if (!report) {
    throw new Error("Reporte no encontrado o no editable.");
  }

  const devices = await prisma.deviceCatalog.findMany({
    where: {
      active: true,
      modelId: report.filler.modelId,
      certificateTypes: { hasSome: implementedTypes },
    },
  });
  const devicesById = new Map(devices.map((device) => [device.id, device]));
  const inputsByDeviceId = new Map(
    input.selections.map((selection) => [selection.deviceCatalogId, selection])
  );

  if (input.selections.length !== devices.length) {
    throw new Error("La selección de dispositivos no coincide con el catálogo activo.");
  }

  for (const selection of input.selections) {
    if (!devicesById.has(selection.deviceCatalogId)) {
      throw new Error("Uno de los dispositivos seleccionados no pertenece al Filler.");
    }
    if (!selection.included && !selection.exclusionReason?.trim()) {
      throw new Error("La razón de exclusión es obligatoria para dispositivos excluidos.");
    }
  }

  await prisma.$transaction(
    devices.map((device) => {
      const selection = inputsByDeviceId.get(device.id);
      if (!selection) {
        throw new Error("Falta una selección de dispositivo.");
      }

      return prisma.reportDeviceSelection.upsert({
        where: {
          reportId_deviceCatalogId: {
            reportId: report.id,
            deviceCatalogId: device.id,
          },
        },
        update: {
          included: selection.included,
          exclusionReason: selection.included ? null : selection.exclusionReason?.trim() ?? null,
          tagNumberSnapshot: device.tagNumber,
          descriptionSnapshot: device.description,
          toleranceValueSnapshot: device.toleranceValue,
          toleranceUnitSnapshot: device.toleranceUnit,
          toleranceIsPercentSnapshot: device.toleranceIsPercent,
          certificateTypesSnapshot: device.certificateTypes,
          displayOrderSnapshot: device.displayOrder,
        },
        create: {
          reportId: report.id,
          deviceCatalogId: device.id,
          included: selection.included,
          exclusionReason: selection.included ? null : selection.exclusionReason?.trim() ?? null,
          tagNumberSnapshot: device.tagNumber,
          descriptionSnapshot: device.description,
          toleranceValueSnapshot: device.toleranceValue,
          toleranceUnitSnapshot: device.toleranceUnit,
          toleranceIsPercentSnapshot: device.toleranceIsPercent,
          certificateTypesSnapshot: device.certificateTypes,
          displayOrderSnapshot: device.displayOrder,
        },
      });
    })
  );

  await logAudit({
    entityType: "Report",
    entityId: report.id,
    action: "update_devices",
    userId: actor.id,
    changes: {
      included: input.selections.filter((selection) => selection.included).length,
      excluded: input.selections.filter((selection) => !selection.included).length,
    },
  });
}

export async function getStandardsWizardData(reportId: string, actor: Actor) {
  const report = await getEditableReport(reportId, actor);
  if (!report) return null;

  const [deviceSelections, standardInstruments, certificates] = await Promise.all([
    prisma.reportDeviceSelection.findMany({
      where: { reportId: report.id },
      orderBy: { tagNumberSnapshot: "asc" },
    }),
    prisma.standardInstrument.findMany({
      where: { active: true },
      orderBy: [{ description: "asc" }, { manufacturer: "asc" }, { model: "asc" }],
    }),
    prisma.certificate.findMany({
      where: { reportId: report.id },
      include: { primaryStandard: true },
    }),
  ]);

  const requiredTypes = requiredCertificateTypes(
    deviceSelections.filter((selection) => selection.included)
  );

  return { report, requiredTypes, standardInstruments, certificates };
}

export async function syncReportStandards(
  actor: Actor,
  input: {
    reportId: string;
    standards: Array<{
      certificateType: CertificateType;
      standardInstrumentId: string;
    }>;
  }
) {
  const report = await getEditableReport(input.reportId, actor);
  if (!report) {
    throw new Error("Reporte no encontrado o no editable.");
  }

  const includedSelections = await prisma.reportDeviceSelection.findMany({
    where: { reportId: report.id, included: true },
  });
  const requiredTypes = requiredCertificateTypes(includedSelections);
  const selectedByType = new Map(
    input.standards
      .filter((standard) => isImplementedType(standard.certificateType))
      .map((standard) => [standard.certificateType, standard.standardInstrumentId])
  );

  for (const certificateType of requiredTypes) {
    if (!selectedByType.get(certificateType)) {
      throw new Error(`Selecciona un instrumento patrón para ${certificateType}.`);
    }
  }

  const selectedInstrumentIds = Array.from(new Set(selectedByType.values()));
  const instruments = await prisma.standardInstrument.findMany({
    where: { id: { in: selectedInstrumentIds }, active: true },
  });
  const instrumentsById = new Map(instruments.map((instrument) => [instrument.id, instrument]));

  for (const certificateType of requiredTypes) {
    const instrumentId = selectedByType.get(certificateType);
    const instrument = instrumentId ? instrumentsById.get(instrumentId) : null;
    if (!instrument) {
      throw new Error(`El instrumento patrón seleccionado para ${certificateType} no existe.`);
    }
    if (instrument.calibrationExpiresAt <= report.serviceDate) {
      throw new Error(
        `El instrumento ${instrument.description} ${instrument.serialNumber} está vencido para la fecha de servicio.`
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.certificate.deleteMany({
      where: {
        reportId: report.id,
        certificateType: { notIn: requiredTypes },
      },
    });

    for (const certificateType of requiredTypes) {
      const instrumentId = selectedByType.get(certificateType);
      if (!instrumentId) continue;

      const instrument = instrumentsById.get(instrumentId);
      if (!instrument) continue;

      const reportStandard = await tx.reportStandard.upsert({
        where: {
          reportId_standardInstrumentId: {
            reportId: report.id,
            standardInstrumentId: instrument.id,
          },
        },
        update: {
          descriptionSnapshot: instrument.description,
          manufacturerSnapshot: instrument.manufacturer,
          modelSnapshot: instrument.model,
          serialSnapshot: instrument.serialNumber,
          certNumberSnapshot: instrument.calibrationCertNumber,
          calDateSnapshot: instrument.calibrationDate,
          calExpiresAtSnapshot: instrument.calibrationExpiresAt,
        },
        create: {
          reportId: report.id,
          standardInstrumentId: instrument.id,
          descriptionSnapshot: instrument.description,
          manufacturerSnapshot: instrument.manufacturer,
          modelSnapshot: instrument.model,
          serialSnapshot: instrument.serialNumber,
          certNumberSnapshot: instrument.calibrationCertNumber,
          calDateSnapshot: instrument.calibrationDate,
          calExpiresAtSnapshot: instrument.calibrationExpiresAt,
        },
      });

      await tx.certificate.upsert({
        where: {
          reportId_certificateType: {
            reportId: report.id,
            certificateType,
          },
        },
        update: {
          primaryStandardId: reportStandard.id,
          layout: getCertificateLayout(certificateType),
        },
        create: {
          reportId: report.id,
          certificateType,
          layout: getCertificateLayout(certificateType),
          primaryStandardId: reportStandard.id,
        },
      });
    }
  });

  await logAudit({
    entityType: "Report",
    entityId: report.id,
    action: "update_standards",
    userId: actor.id,
    changes: {
      requiredTypes,
    } satisfies Prisma.InputJsonObject,
  });
}

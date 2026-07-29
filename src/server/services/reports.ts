import {
  CertificateType,
  Prisma,
  ReportStatus,
  type DeviceType,
  type UserRole,
} from "@prisma/client";
import { prisma } from "@/server/db";
import { generateReportNumber } from "@/server/domain/report-number";
import { logAudit } from "@/server/services/audit";
import {
  revokeCertificateSignatures,
  revokeReportSignatures,
} from "@/server/services/signatures";
import {
  getCertificateConfig,
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

  return implementedTypes.filter(
    (type) => types.has(type) || getCertificateConfig(type).alwaysRequired
  );
}

/**
 * Los patrones de un certificado, serializados tal como se imprimen en sus
 * bloques de validación. Comparar dos huellas dice si la firma sigue
 * acreditando lo que la página muestra.
 */
type StandardSnapshot = {
  descriptionSnapshot: string;
  manufacturerSnapshot: string;
  modelSnapshot: string;
  serialSnapshot: string;
  certificationStatusSnapshot: string;
  certNumberSnapshot: string | null;
  calDateSnapshot: Date | null;
  calExpiresAtSnapshot: Date | null;
};

function standardsFingerprint(standards: StandardSnapshot[]): string {
  return JSON.stringify(
    standards.map((standard) => [
      standard.descriptionSnapshot,
      standard.manufacturerSnapshot,
      standard.modelSnapshot,
      standard.serialSnapshot,
      standard.certificationStatusSnapshot,
      standard.certNumberSnapshot,
      standard.calDateSnapshot?.toISOString() ?? null,
      standard.calExpiresAtSnapshot?.toISOString() ?? null,
    ])
  );
}

/** El snapshot que quedará guardado al registrar este instrumento. */
function instrumentSnapshot(instrument: {
  description: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  certificationStatus: string;
  calibrationCertNumber: string | null;
  calibrationDate: Date | null;
  calibrationExpiresAt: Date | null;
}): StandardSnapshot {
  return {
    descriptionSnapshot: instrument.description,
    manufacturerSnapshot: instrument.manufacturer,
    modelSnapshot: instrument.model,
    serialSnapshot: instrument.serialNumber,
    certificationStatusSnapshot: instrument.certificationStatus,
    certNumberSnapshot: instrument.calibrationCertNumber,
    calDateSnapshot: instrument.calibrationDate,
    calExpiresAtSnapshot: instrument.calibrationExpiresAt,
  };
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
  const observations = input.observations?.trim() || null;

  // Todo esto se imprime y entra al payload firmado. El número de reporte
  // además encabeza cada certificado, así que un cambio ahí tumba también las
  // firmas de las secciones.
  const reportNumberChanged = report.reportNumber !== reportNumber;
  const identityChanged =
    reportNumberChanged ||
    fillerChanged ||
    report.serviceDate.getTime() !== serviceDate.getTime() ||
    report.observations !== observations;

  const updated = await prisma.$transaction(async (tx) => {
    if (fillerChanged) {
      await tx.certificate.deleteMany({ where: { reportId: report.id } });
      await tx.reportStandard.deleteMany({ where: { reportId: report.id } });
      await tx.reportDeviceSelection.deleteMany({ where: { reportId: report.id } });
    }

    if (reportNumberChanged && !fillerChanged) {
      const certificates = await tx.certificate.findMany({
        where: { reportId: report.id },
        select: { id: true },
      });
      for (const certificate of certificates) {
        await revokeCertificateSignatures(tx, certificate.id);
      }
    }

    if (identityChanged) {
      await revokeReportSignatures(tx, report.id);
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
      observations,
      resetSelections: fillerChanged,
      revokedSignatures: identityChanged,
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

/**
 * Alta de un sensor faltante desde el checklist del reporte.
 *
 * El dispositivo se crea en el catálogo del modelo del Filler, así queda
 * disponible para los próximos reportes del mismo equipo. Devuelve `null`
 * cuando el reporte no es editable y `"duplicate"` cuando la etiqueta ya existe
 * para ese modelo (la unique key es modelId + tagNumber).
 */
export async function createChecklistDevice(
  actor: Actor,
  input: {
    reportId: string;
    tagNumber: string;
    description: string;
    deviceType: DeviceType;
    toleranceValue: string;
    toleranceUnit: string;
    toleranceIsPercent: boolean;
    certificateTypes: CertificateType[];
  }
) {
  const report = await getEditableReport(input.reportId, actor);
  if (!report) {
    throw new Error("Reporte no encontrado o no editable.");
  }

  const certificateTypes = implementedTypes.filter((type) =>
    input.certificateTypes.includes(type)
  );
  if (certificateTypes.length === 0) {
    throw new Error("El sensor debe tener al menos un certificado implementado.");
  }

  const modelId = report.filler.modelId;
  const tagNumber = input.tagNumber.trim();

  const existing = await prisma.deviceCatalog.findUnique({
    where: { modelId_tagNumber: { modelId, tagNumber } },
    select: { id: true },
  });
  if (existing) return "duplicate" as const;

  const last = await prisma.deviceCatalog.aggregate({
    where: { modelId },
    _max: { displayOrder: true },
  });

  const device = await prisma.deviceCatalog.create({
    data: {
      modelId,
      tagNumber,
      description: input.description.trim(),
      deviceType: input.deviceType,
      toleranceValue: new Prisma.Decimal(input.toleranceValue),
      toleranceUnit: input.toleranceUnit.trim(),
      toleranceIsPercent: input.toleranceIsPercent,
      certificateTypes,
      displayOrder: (last._max.displayOrder ?? 0) + 1,
      active: true,
    },
  });

  await logAudit({
    entityType: "DeviceCatalog",
    entityId: device.id,
    action: "create",
    userId: actor.id,
    changes: {
      modelId,
      tagNumber: device.tagNumber,
      description: device.description,
      deviceType: device.deviceType,
      toleranceValue: device.toleranceValue.toString(),
      toleranceUnit: device.toleranceUnit,
      toleranceIsPercent: device.toleranceIsPercent,
      certificateTypes: device.certificateTypes,
      createdFromReportId: report.id,
    },
  });

  return device;
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

  // El alcance se imprime en la página de alcance y define qué columnas lleva
  // cada certificado. Cambiarlo invalida las firmas de las secciones tocadas.
  const previousSelections = await prisma.reportDeviceSelection.findMany({
    where: { reportId: report.id },
  });
  const previousByDeviceId = new Map(
    previousSelections.map((selection) => [selection.deviceCatalogId, selection])
  );
  const changedTypes = new Set<CertificateType>();
  let scopeChanged = false;

  for (const device of devices) {
    const selection = inputsByDeviceId.get(device.id);
    const previous = previousByDeviceId.get(device.id);
    if (!selection) continue;

    const reason = selection.included ? null : selection.exclusionReason?.trim() ?? null;
    // Se comparan TODOS los snapshots, no solo incluido y motivo: este paso los
    // refresca desde el catálogo, así que un admin que edite la descripción o
    // la tolerancia cambia lo que imprime un certificado ya firmado sin que el
    // ingeniero toque nada.
    const changed =
      !previous ||
      previous.included !== selection.included ||
      previous.exclusionReason !== reason ||
      previous.tagNumberSnapshot !== device.tagNumber ||
      previous.descriptionSnapshot !== device.description ||
      previous.deviceTypeSnapshot !== device.deviceType ||
      !previous.toleranceValueSnapshot.equals(device.toleranceValue) ||
      previous.toleranceUnitSnapshot !== device.toleranceUnit ||
      previous.toleranceIsPercentSnapshot !== device.toleranceIsPercent ||
      previous.displayOrderSnapshot !== device.displayOrder ||
      previous.certificateTypesSnapshot.join(",") !== device.certificateTypes.join(",");

    if (changed) {
      scopeChanged = true;
      // Un dispositivo puede pertenecer a más de un certificado.
      for (const type of device.certificateTypes) changedTypes.add(type);
      for (const type of previous?.certificateTypesSnapshot ?? []) changedTypes.add(type);
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
          deviceTypeSnapshot: device.deviceType,
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
          deviceTypeSnapshot: device.deviceType,
          toleranceValueSnapshot: device.toleranceValue,
          toleranceUnitSnapshot: device.toleranceUnit,
          toleranceIsPercentSnapshot: device.toleranceIsPercent,
          certificateTypesSnapshot: device.certificateTypes,
          displayOrderSnapshot: device.displayOrder,
        },
      });
    })
  );

  if (scopeChanged) {
    await prisma.$transaction(async (tx) => {
      const affected = await tx.certificate.findMany({
        where: { reportId: report.id, certificateType: { in: [...changedTypes] } },
        select: { id: true },
      });
      for (const certificate of affected) {
        await revokeCertificateSignatures(tx, certificate.id);
      }
      // La página de alcance es contenido del reporte, no de una sección: la
      // firma general cae aunque el dispositivo tocado no tenga certificado.
      await revokeReportSignatures(tx, report.id);
    });
  }

  await logAudit({
    entityType: "Report",
    entityId: report.id,
    action: "update_devices",
    userId: actor.id,
    changes: {
      included: input.selections.filter((selection) => selection.included).length,
      excluded: input.selections.filter((selection) => !selection.included).length,
      revokedSignaturesFor: [...changedTypes],
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
      include: {
        primaryStandard: true,
        additionalStandards: {
          include: { reportStandard: true },
          orderBy: { displayOrder: "asc" },
        },
      },
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
      additionalStandardInstrumentIds?: string[];
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
  // Los complementarios se validan igual que el principal: si respaldan el
  // certificado, tienen que estar vigentes en la fecha de servicio.
  const additionalByType = new Map(
    input.standards
      .filter((standard) => isImplementedType(standard.certificateType))
      .map((standard) => [
        standard.certificateType,
        Array.from(
          new Set(
            (standard.additionalStandardInstrumentIds ?? []).filter(
              (id) => id && id !== standard.standardInstrumentId
            )
          )
        ),
      ])
  );

  for (const certificateType of requiredTypes) {
    if (!selectedByType.get(certificateType)) {
      throw new Error(`Selecciona un instrumento patrón para ${certificateType}.`);
    }
  }

  const selectedInstrumentIds = Array.from(
    new Set([
      ...selectedByType.values(),
      ...requiredTypes.flatMap(
        (certificateType) => additionalByType.get(certificateType) ?? []
      ),
    ])
  );
  const instruments = await prisma.standardInstrument.findMany({
    where: { id: { in: selectedInstrumentIds }, active: true },
  });
  const instrumentsById = new Map(instruments.map((instrument) => [instrument.id, instrument]));

  for (const certificateType of requiredTypes) {
    const usedIds = [
      selectedByType.get(certificateType),
      ...(additionalByType.get(certificateType) ?? []),
    ];

    for (const instrumentId of usedIds) {
      const instrument = instrumentId ? instrumentsById.get(instrumentId) : null;
      if (!instrument) {
        throw new Error(`El instrumento patrón seleccionado para ${certificateType} no existe.`);
      }
      if (instrument.certificationStatus === "PENDING") {
        throw new Error(
          `El instrumento ${instrument.description} ${instrument.serialNumber} está pendiente de certificación.`
        );
      }
      if (
        instrument.certificationStatus === "CERTIFIED" &&
        (!instrument.calibrationCertNumber ||
          !instrument.calibrationDate ||
          !instrument.calibrationExpiresAt)
      ) {
        throw new Error(
          `El instrumento ${instrument.description} ${instrument.serialNumber} tiene datos de certificación incompletos.`
        );
      }
      if (
        instrument.certificationStatus === "CERTIFIED" &&
        instrument.calibrationExpiresAt &&
        instrument.calibrationExpiresAt <= report.serviceDate
      ) {
        throw new Error(
          `El instrumento ${instrument.description} ${instrument.serialNumber} está vencido para la fecha de servicio.`
        );
      }
    }
  }

  // Estado firmado de los patrones antes de tocar nada, para saber a qué
  // certificados hay que revocarles la firma.
  const before = await prisma.certificate.findMany({
    where: { reportId: report.id },
    include: {
      primaryStandard: true,
      additionalStandards: {
        include: { reportStandard: true },
        orderBy: { displayOrder: "asc" },
      },
    },
  });
  const fingerprintBefore = new Map(
    before.map((certificate) => [
      certificate.certificateType,
      standardsFingerprint([
        certificate.primaryStandard,
        ...certificate.additionalStandards.map((link) => link.reportStandard),
      ]),
    ])
  );

  const revokedTypes: CertificateType[] = [];

  await prisma.$transaction(async (tx) => {
    const removed = await tx.certificate.deleteMany({
      where: {
        reportId: report.id,
        certificateType: { notIn: requiredTypes },
      },
    });

    // Borrar el certificado se lleva su firma en cascada, pero la general
    // quedaría acreditando un conjunto de secciones que ya no existe.
    if (removed.count > 0) {
      await revokeReportSignatures(tx, report.id);
    }

    /** Registra el instrumento en el reporte, refrescando su snapshot. */
    const upsertReportStandard = async (instrumentId: string) => {
      const instrument = instrumentsById.get(instrumentId);
      if (!instrument) return null;

      const snapshot = {
        descriptionSnapshot: instrument.description,
        manufacturerSnapshot: instrument.manufacturer,
        modelSnapshot: instrument.model,
        serialSnapshot: instrument.serialNumber,
        certificationStatusSnapshot: instrument.certificationStatus,
        certNumberSnapshot: instrument.calibrationCertNumber,
        calDateSnapshot: instrument.calibrationDate,
        calExpiresAtSnapshot: instrument.calibrationExpiresAt,
      };

      return tx.reportStandard.upsert({
        where: {
          reportId_standardInstrumentId: {
            reportId: report.id,
            standardInstrumentId: instrument.id,
          },
        },
        update: snapshot,
        create: {
          reportId: report.id,
          standardInstrumentId: instrument.id,
          ...snapshot,
        },
      });
    };

    for (const certificateType of requiredTypes) {
      const instrumentId = selectedByType.get(certificateType);
      if (!instrumentId) continue;

      const reportStandard = await upsertReportStandard(instrumentId);
      if (!reportStandard) continue;

      const certificate = await tx.certificate.upsert({
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

      const additionalIds = additionalByType.get(certificateType) ?? [];
      const linkedStandardIds: string[] = [];
      for (const [index, additionalId] of additionalIds.entries()) {
        const additional = await upsertReportStandard(additionalId);
        if (!additional) continue;

        linkedStandardIds.push(additional.id);
        await tx.certificateStandard.upsert({
          where: {
            certificateId_reportStandardId: {
              certificateId: certificate.id,
              reportStandardId: additional.id,
            },
          },
          update: { displayOrder: (index + 1) * 10 },
          create: {
            certificateId: certificate.id,
            reportStandardId: additional.id,
            displayOrder: (index + 1) * 10,
          },
        });
      }

      // Quitar un complementario de la selección debe quitarlo del certificado.
      await tx.certificateStandard.deleteMany({
        where: {
          certificateId: certificate.id,
          reportStandardId: { notIn: linkedStandardIds },
        },
      });

      // La firma acredita los patrones impresos en la página. Si cambia el
      // instrumento, se le suma o quita un complementario, o se refresca su
      // certificación, deja de valer. Un guardado que no mueve nada no revoca:
      // volver al paso y presionar guardar no puede costar las firmas.
      const previous = fingerprintBefore.get(certificateType);
      const current = standardsFingerprint([
        instrumentSnapshot(instrumentsById.get(instrumentId)!),
        ...additionalIds.flatMap((id) => {
          const instrument = instrumentsById.get(id);
          return instrument ? [instrumentSnapshot(instrument)] : [];
        }),
      ]);

      if (previous !== undefined && previous !== current) {
        await revokeCertificateSignatures(tx, certificate.id);
        revokedTypes.push(certificateType);
      }
    }
  });

  await logAudit({
    entityType: "Report",
    entityId: report.id,
    action: "update_standards",
    userId: actor.id,
    changes: {
      requiredTypes,
      // Queda asentado qué secciones perdieron su firma por el cambio.
      revokedSignaturesFor: revokedTypes,
    } satisfies Prisma.InputJsonObject,
  });
}

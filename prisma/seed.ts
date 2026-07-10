import { PrismaClient, DeviceType, CertificateType, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ============ USERS ============
  const passwordHash = await bcrypt.hash("changeme123", 10);

  const engineer = await prisma.user.upsert({
    where: { email: "robert.aubuchon@sig.biz" },
    update: {},
    create: {
      email: "robert.aubuchon@sig.biz",
      passwordHash,
      name: "Robert Au Buchon",
      title: "Field Service Engineer II",
      role: UserRole.ENGINEER,
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@sig.biz" },
    update: {},
    create: {
      email: "admin@sig.biz",
      passwordHash,
      name: "System Admin",
      title: "Administrator",
      role: UserRole.ADMIN,
    },
  });

  console.log(`✔ Users: ${engineer.email}, ${admin.email}`);

  // ============ FILLER MODEL: SureFill 100 ============
  const surefill = await prisma.fillerModel.upsert({
    where: { code: "SUREFILL_100" },
    update: {},
    create: {
      code: "SUREFILL_100",
      name: "SureFill 100",
    },
  });

  console.log(`✔ Filler model: ${surefill.name}`);

  // ============ DEVICE CATALOG ============
  // Los 26 dispositivos de la página "Calibration Applied" del reporte real
  // CR_Nestle_20260512_CC_Rev2 (Nestle Fort Smith, SureFill 100 #652).
  //
  // Nota: los tags 1403 y 1411 (Metering Pump MOT-1 / MOT-2) pertenecen a DOS
  // certificados: Chamber Sterilization (p.12) y Tunnel Sterilization (p.13).
  const devices = [
    // Temperature - RTD, ± 1.0 °C (p.3)
    { tag: "1573", desc: "Vaporizer Temperature Sensor - RTD",      type: DeviceType.RTD, tolValue: "1.0",   tolUnit: "°C",   isPct: false, certs: [CertificateType.TEMPERATURE],              order: 10 },
    { tag: "1569", desc: "Pre Heater-Temperature Sensor - RTD",     type: DeviceType.RTD, tolValue: "1.0",   tolUnit: "°C",   isPct: false, certs: [CertificateType.TEMPERATURE],              order: 20 },
    { tag: "1605", desc: "Sterile Tunnel Temperature Sensor - RTD", type: DeviceType.RTD, tolValue: "1.0",   tolUnit: "°C",   isPct: false, certs: [CertificateType.TEMPERATURE],              order: 30 },
    { tag: "1607", desc: "Chamber Temperature Sensor - RTD",        type: DeviceType.RTD, tolValue: "1.0",   tolUnit: "°C",   isPct: false, certs: [CertificateType.TEMPERATURE],              order: 40 },

    // Air Flow - FM, ± 0.500 SCFM (p.4, p.5)
    { tag: "3547", desc: "Chamber VST Air Flow Sensor - FM",        type: DeviceType.FM,  tolValue: "0.500", tolUnit: "SCFM", isPct: false, certs: [CertificateType.CHAMBER_VST_AIR_FLOW],     order: 10 },
    { tag: "3546", desc: "Chamber Sterile Air Flow Sensor - FM",    type: DeviceType.FM,  tolValue: "0.500", tolUnit: "SCFM", isPct: false, certs: [CertificateType.CHAMBER_STERILE_AIR_FLOW], order: 10 },

    // Pressure - PS, ± 0.05 % PSI (p.6)
    { tag: "3545", desc: "Tank N2 Pressure Sensor - PS",            type: DeviceType.PS,  tolValue: "0.05",  tolUnit: "PSI",  isPct: true,  certs: [CertificateType.PRESSURE],                 order: 10 },
    { tag: "3527", desc: "Chamber Pressure Sensor - PS",            type: DeviceType.PS,  tolValue: "0.05",  tolUnit: "PSI",  isPct: true,  certs: [CertificateType.PRESSURE],                 order: 20 },
    { tag: "3526", desc: "N2 Supply Pressure Sensor - PS",          type: DeviceType.PS,  tolValue: "0.05",  tolUnit: "PSI",  isPct: true,  certs: [CertificateType.PRESSURE],                 order: 30 },

    // Vacuum Tank - PS, ± 0.10 % Hg (p.7)
    { tag: "1700", desc: "Vacuum Tank - Vacuum Sensor - PS",        type: DeviceType.PS,  tolValue: "0.10",  tolUnit: "Hg",   isPct: true,  certs: [CertificateType.VACUUM_TANK_PRESSURE],     order: 10 },

    // EOL Flow - FM, ± 1.0 % L/m (p.8)
    { tag: "1624", desc: "Station 1 EOL Flow Sensor - FM",          type: DeviceType.FM,  tolValue: "1.0",   tolUnit: "L/m",  isPct: true,  certs: [CertificateType.EOL_FLOW],                 order: 10 },
    { tag: "1625", desc: "Station 2 EOL Flow Sensor - FM",          type: DeviceType.FM,  tolValue: "1.0",   tolUnit: "L/m",  isPct: true,  certs: [CertificateType.EOL_FLOW],                 order: 20 },
    { tag: "1626", desc: "Station 3 EOL Flow Sensor - FM",          type: DeviceType.FM,  tolValue: "1.0",   tolUnit: "L/m",  isPct: true,  certs: [CertificateType.EOL_FLOW],                 order: 30 },
    { tag: "1627", desc: "Station 4 EOL Flow Sensor - FM",          type: DeviceType.FM,  tolValue: "1.0",   tolUnit: "L/m",  isPct: true,  certs: [CertificateType.EOL_FLOW],                 order: 40 },

    // VAC Flow - FM, ± 1.0 % L/m (p.9)
    { tag: "1684", desc: "Station 1 VAC Flow Sensor - FM",          type: DeviceType.FM,  tolValue: "1.0",   tolUnit: "L/m",  isPct: true,  certs: [CertificateType.VAC_FLOW],                 order: 10 },
    { tag: "1685", desc: "Station 2 VAC Flow Sensor - FM",          type: DeviceType.FM,  tolValue: "1.0",   tolUnit: "L/m",  isPct: true,  certs: [CertificateType.VAC_FLOW],                 order: 20 },
    { tag: "1686", desc: "Station 3 VAC Flow Sensor - FM",          type: DeviceType.FM,  tolValue: "1.0",   tolUnit: "L/m",  isPct: true,  certs: [CertificateType.VAC_FLOW],                 order: 30 },
    { tag: "1687", desc: "Station 4 VAC Flow Sensor - FM",          type: DeviceType.FM,  tolValue: "1.0",   tolUnit: "L/m",  isPct: true,  certs: [CertificateType.VAC_FLOW],                 order: 40 },

    // Humidity - HS, ± 2 % RH (p.10)
    { tag: "1524", desc: "Humidity Sensor - HS",                    type: DeviceType.HS,  tolValue: "2.0",   tolUnit: "% RH", isPct: true,  certs: [CertificateType.HUMIDITY],                 order: 10 },

    // Ultrasonic - US, ± 10 % g (p.11)
    { tag: "1520", desc: "Reservoir Ultrasonic - US",               type: DeviceType.US,  tolValue: "10.0",  tolUnit: "g",    isPct: true,  certs: [CertificateType.ULTRASONIC],               order: 10 },

    // Metering Pump - MOT, ± 10 % g (p.12 y p.13)
    { tag: "1403", desc: "Metering Pump – MOT - 1",                 type: DeviceType.MOT, tolValue: "10.0",  tolUnit: "g",    isPct: true,  certs: [CertificateType.METERING_PUMP_CHAMBER, CertificateType.METERING_PUMP_TUNNEL], order: 10 },
    { tag: "1411", desc: "Metering Pump – MOT - 2",                 type: DeviceType.MOT, tolValue: "10.0",  tolUnit: "g",    isPct: true,  certs: [CertificateType.METERING_PUMP_CHAMBER, CertificateType.METERING_PUMP_TUNNEL], order: 20 },

    // Vacuum Pressure por estación - PS, ± 0.10 % Hg (p.15)
    { tag: "1702", desc: "Station 1 - Vacuum Sensor - PS",          type: DeviceType.PS,  tolValue: "0.10",  tolUnit: "Hg",   isPct: true,  certs: [CertificateType.VACUUM_PRESSURE],          order: 10 },
    { tag: "1703", desc: "Station 2 - Vacuum Sensor - PS",          type: DeviceType.PS,  tolValue: "0.10",  tolUnit: "Hg",   isPct: true,  certs: [CertificateType.VACUUM_PRESSURE],          order: 20 },
    { tag: "1706", desc: "Station 3 - Vacuum Sensor - PS",          type: DeviceType.PS,  tolValue: "0.10",  tolUnit: "Hg",   isPct: true,  certs: [CertificateType.VACUUM_PRESSURE],          order: 30 },
    { tag: "1707", desc: "Station 4 - Vacuum Sensor - PS",          type: DeviceType.PS,  tolValue: "0.10",  tolUnit: "Hg",   isPct: true,  certs: [CertificateType.VACUUM_PRESSURE],          order: 40 },
  ];

  for (const d of devices) {
    const data = {
      description: d.desc,
      deviceType: d.type,
      toleranceValue: d.tolValue,
      toleranceUnit: d.tolUnit,
      toleranceIsPercent: d.isPct,
      certificateTypes: d.certs,
      displayOrder: d.order,
    };

    await prisma.deviceCatalog.upsert({
      where: { modelId_tagNumber: { modelId: surefill.id, tagNumber: d.tag } },
      update: data,
      create: { modelId: surefill.id, tagNumber: d.tag, ...data },
    });
  }
  console.log(`✔ Device catalog: ${devices.length} devices`);

  // ============ FILLER: Nestle Fort Smith #652 ============
  await prisma.filler.upsert({
    where: { modelId_serialNumber: { modelId: surefill.id, serialNumber: "652" } },
    update: {},
    create: {
      modelId: surefill.id,
      serialNumber: "652",
      clientName: "NESTLE",
      clientAddress: "4301 HARRIET AVE.",
      clientCity: "FORT SMITH",
      clientState: "AR",
      clientZip: "72904",
    },
  });
  console.log(`✔ Filler: Nestle Fort Smith #652`);

  // ============ STANDARD INSTRUMENTS ============
  // Instrumentos patrón usados en el reporte real, uno por certificado
  // implementado. `calibrationExpiresAt` NO aparece en el PDF: es un campo de
  // la app, acá se asume un año de vigencia desde la fecha de calibración.
  //
  // Faltan los patrones de Ultrasonic y Metering Pump (Tanita 1475T y el peso
  // Troemner de 200 g): el peso no tiene modelo, certificado ni fecha de
  // calibración, y esos campos todavía son obligatorios en el schema.
  const standards = [
    {
      // p.3 - Temperature
      description: "Dry Well",
      manufacturer: "FLUKE",
      model: "9140",
      serialNumber: "C61610",
      calibrationCertNumber: "703892",
      calibrationDate: new Date("2026-02-25"),
      calibrationExpiresAt: new Date("2027-02-25"),
    },
    {
      // p.4 - Chamber VST Air Flow
      description: "Pilot Tube Anemometer",
      manufacturer: "EXTECH",
      model: "HD 350",
      serialNumber: "2511040643",
      calibrationCertNumber: "690576",
      calibrationDate: new Date("2026-03-20"),
      calibrationExpiresAt: new Date("2027-03-20"),
    },
    {
      // p.5 y p.14 - Chamber Sterile Air Flow, Exhaust
      description: "Rotary Vane Manometer",
      manufacturer: "EXTECH",
      model: "HD 300",
      serialNumber: "Z325013",
      calibrationCertNumber: "683274",
      calibrationDate: new Date("2026-03-03"),
      calibrationExpiresAt: new Date("2027-03-03"),
    },
    {
      // p.6, p.7 y p.15 - Pressure, Vacuum Tank, Vacuum
      description: "Precision Pressure Gauge",
      manufacturer: "FLUKE",
      model: "700G06",
      serialNumber: "4792075",
      calibrationCertNumber: "680724",
      calibrationDate: new Date("2026-02-24"),
      calibrationExpiresAt: new Date("2027-02-24"),
    },
    {
      // p.8 y p.9 - EOL Flow, VAC Flow
      description: "Electronic Digital Flow Meter",
      manufacturer: "FLOMEC",
      model: "A1",
      serialNumber: "2722432",
      calibrationCertNumber: "132566",
      calibrationDate: new Date("2026-03-09"),
      calibrationExpiresAt: new Date("2027-03-09"),
    },
    {
      // p.10 - Humidity. La fecha de calibración real del PDF es 11/17/22; con
      // un año de vigencia quedaría vencida para la fecha de servicio y el
      // wizard la rechazaría. Se extiende para que el seed sea usable.
      description: "Salt Solution",
      manufacturer: "E+E",
      model: "HA010410",
      serialNumber: "20221004",
      calibrationCertNumber: "KA017619",
      calibrationDate: new Date("2022-11-17"),
      calibrationExpiresAt: new Date("2027-11-17"),
    },
  ];

  for (const s of standards) {
    const existing = await prisma.standardInstrument.findFirst({
      where: { serialNumber: s.serialNumber },
    });
    if (existing) continue;

    await prisma.standardInstrument.create({
      data: s,
    });
  }
  console.log(`✔ Standard instruments: ${standards.length}`);

  console.log("✅ Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

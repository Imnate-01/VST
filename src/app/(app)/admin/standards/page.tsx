import { StandardInstrumentsManager, type StandardInstrumentItem } from "@/components/admin/standard-instruments-manager";
import { requireAdmin } from "@/server/auth";
import { prisma } from "@/server/db";

export default async function AdminStandardsPage() {
  await requireAdmin();
  const standards = await prisma.standardInstrument.findMany({
    orderBy: [{ active: "desc" }, { calibrationExpiresAt: "asc" }],
    include: { _count: { select: { reportStandards: true } } },
  });

  const items: StandardInstrumentItem[] = standards.map((standard) => ({
    id: standard.id,
    description: standard.description,
    manufacturer: standard.manufacturer,
    model: standard.model,
    serialNumber: standard.serialNumber,
    calibrationCertNumber: standard.calibrationCertNumber,
    calibrationDate: standard.calibrationDate.toISOString().slice(0, 10),
    calibrationExpiresAt: standard.calibrationExpiresAt.toISOString().slice(0, 10),
    active: standard.active,
    linkedReports: standard._count.reportStandards,
  }));

  return <StandardInstrumentsManager instruments={items} />;
}

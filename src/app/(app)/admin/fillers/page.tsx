import { Check, X } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Card, CardContent } from "@/components/ui/card";
import { getTranslations } from "@/lib/i18n-server";
import { requireAdmin } from "@/server/auth";
import { prisma } from "@/server/db";

export default async function AdminFillersPage() {
  await requireAdmin();
  const { t } = await getTranslations();
  const fillers = await prisma.filler.findMany({
    orderBy: [{ clientName: "asc" }, { serialNumber: "asc" }],
    include: { model: true, _count: { select: { reports: true } } },
  });

  return (
    <div className="space-y-7">
      <AdminPageHeader title={t("admin.fillersTitle")} description={t("admin.fillersDescription")} />
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="table-modern min-w-[900px]">
              <thead>
                <tr>
                  <th>{t("admin.client")}</th>
                  <th>{t("admin.model")}</th>
                  <th>{t("admin.serial")}</th>
                  <th>{t("admin.location")}</th>
                  <th>{t("admin.reports")}</th>
                  <th>{t("admin.status")}</th>
                </tr>
              </thead>
              <tbody>
                {fillers.map((filler) => (
                  <tr key={filler.id}>
                    <td>
                      <div className="font-semibold">{filler.clientName}</div>
                      <div className="text-xs text-muted-foreground">{filler.clientAddress}</div>
                    </td>
                    <td>{filler.model.name}</td>
                    <td className="technical-id">{filler.serialNumber}</td>
                    <td>{filler.clientCity}, {filler.clientState} {filler.clientZip}</td>
                    <td className="technical-id">{filler._count.reports}</td>
                    <td>
                      <span
                        className={
                          filler.active
                            ? "status-badge border-success/25 bg-success-muted text-success"
                            : "status-badge border-destructive/25 bg-destructive/5 text-destructive"
                        }
                      >
                        {filler.active ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                        {filler.active ? t("admin.active") : t("admin.inactive")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { Check, X } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Card, CardContent } from "@/components/ui/card";
import { getTranslations } from "@/lib/i18n-server";
import { requireAdmin } from "@/server/auth";
import { prisma } from "@/server/db";

export default async function AdminDevicesPage() {
  await requireAdmin();
  const { t } = await getTranslations();
  const devices = await prisma.deviceCatalog.findMany({
    orderBy: [{ model: { name: "asc" } }, { displayOrder: "asc" }],
    include: { model: true },
  });

  return (
    <div className="space-y-7">
      <AdminPageHeader title={t("admin.devicesTitle")} description={t("admin.devicesDescription")} />
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="table-modern min-w-[980px]">
              <thead>
                <tr>
                  <th>Tag</th>
                  <th>{t("admin.device")}</th>
                  <th>{t("admin.type")}</th>
                  <th>{t("admin.model")}</th>
                  <th>{t("admin.tolerance")}</th>
                  <th>{t("admin.certificates")}</th>
                  <th>{t("admin.status")}</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((device) => (
                  <tr key={device.id}>
                    <td className="technical-id font-semibold">{device.tagNumber}</td>
                    <td>{device.description}</td>
                    <td>
                      <span className="status-badge border-border bg-muted text-foreground">
                        {device.deviceType}
                      </span>
                    </td>
                    <td>{device.model.name}</td>
                    <td className="technical-id">
                      ± {device.toleranceValue.toString()}
                      {device.toleranceIsPercent ? "%" : ""} {device.toleranceUnit}
                    </td>
                    <td className="max-w-72 text-xs text-muted-foreground">
                      {device.certificateTypes.join(", ").replaceAll("_", " ")}
                    </td>
                    <td>
                      <span
                        className={
                          device.active
                            ? "status-badge border-success/25 bg-success-muted text-success"
                            : "status-badge border-destructive/25 bg-destructive/5 text-destructive"
                        }
                      >
                        {device.active ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                        {device.active ? t("admin.active") : t("admin.inactive")}
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

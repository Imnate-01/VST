import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Card, CardContent } from "@/components/ui/card";
import { getTranslations } from "@/lib/i18n-server";
import { requireAdmin } from "@/server/auth";
import { prisma } from "@/server/db";

export default async function AdminAuditPage() {
  await requireAdmin();
  const { t } = await getTranslations();
  const logs = await prisma.auditLog.findMany({
    orderBy: { occurredAt: "desc" },
    take: 100,
    include: { user: { select: { name: true, email: true } } },
  });

  return (
    <div className="space-y-7">
      <AdminPageHeader title={t("admin.auditTitle")} description={t("admin.auditDescription")} />
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <p className="py-14 text-center text-sm text-muted-foreground">{t("admin.noRecords")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-modern min-w-[980px]">
                <thead>
                  <tr>
                    <th>{t("admin.date")}</th>
                    <th>{t("admin.user")}</th>
                    <th>{t("admin.action")}</th>
                    <th>{t("admin.entity")}</th>
                    <th>{t("admin.details")}</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td className="technical-id whitespace-nowrap text-muted-foreground">
                        {log.occurredAt.toISOString().replace("T", " ").slice(0, 19)} UTC
                      </td>
                      <td>
                        <div className="font-medium">{log.user.name}</div>
                        <div className="technical-id text-[11px] text-muted-foreground">{log.user.email}</div>
                      </td>
                      <td>
                        <span className="status-badge border-primary/20 bg-primary/5 text-primary">
                          {log.action}
                        </span>
                      </td>
                      <td>
                        <div>{log.entityType}</div>
                        <div className="technical-id max-w-52 truncate text-xs text-muted-foreground">{log.entityId}</div>
                      </td>
                      <td>
                        <code className="block max-w-80 truncate text-xs text-muted-foreground">
                          {log.changes ? JSON.stringify(log.changes) : "—"}
                        </code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

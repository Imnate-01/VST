import { Check, X } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Card, CardContent } from "@/components/ui/card";
import { getTranslations } from "@/lib/i18n-server";
import { requireAdmin } from "@/server/auth";
import { prisma } from "@/server/db";

export default async function AdminUsersPage() {
  await requireAdmin();
  const { t } = await getTranslations();
  const users = await prisma.user.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { _count: { select: { reports: true } } },
  });

  return (
    <div className="space-y-7">
      <AdminPageHeader title={t("admin.usersTitle")} description={t("admin.usersDescription")} />
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="table-modern min-w-[850px]">
              <thead>
                <tr>
                  <th>{t("admin.name")}</th>
                  <th>{t("admin.email")}</th>
                  <th>{t("admin.role")}</th>
                  <th>{t("admin.status")}</th>
                  <th>{t("admin.reports")}</th>
                  <th>{t("admin.updated")}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="font-semibold">{user.name}</div>
                      <div className="text-xs text-muted-foreground">{user.title}</div>
                    </td>
                    <td className="technical-id text-muted-foreground">{user.email}</td>
                    <td>
                      <span className="status-badge border-border bg-muted text-foreground">
                        {user.role}
                      </span>
                    </td>
                    <td>
                      <span
                        className={
                          user.active
                            ? "status-badge border-success/25 bg-success-muted text-success"
                            : "status-badge border-destructive/25 bg-destructive/5 text-destructive"
                        }
                      >
                        {user.active ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                        {user.active ? t("admin.active") : t("admin.inactive")}
                      </span>
                    </td>
                    <td className="technical-id">{user._count.reports}</td>
                    <td className="technical-id text-muted-foreground">
                      {user.updatedAt.toISOString().slice(0, 10)}
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

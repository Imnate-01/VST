import { UserRound } from "lucide-react";
import { ProfileForms } from "@/components/profile/profile-forms";
import { getTranslations } from "@/lib/i18n-server";
import { requireAuth } from "@/server/auth";

export default async function ProfilePage() {
  const session = await requireAuth();
  const { t } = await getTranslations();

  return (
    <div className="space-y-7">
      <header className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <UserRound className="h-6 w-6" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("profile.title")}</h1>
          <p className="mt-1 text-muted-foreground">{t("profile.description")}</p>
        </div>
      </header>

      <ProfileForms
        initialValues={{
          name: session.user.name ?? "",
          title: session.user.title,
          email: session.user.email ?? "",
        }}
      />
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { updateOwnProfile, changeOwnPassword } from "@/server/actions/profile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/components/language-provider";

type Result = { tone: "success" | "error"; message: string } | null;

function FormResult({ result }: { result: Result }) {
  if (!result) return null;
  return (
    <div
      role="status"
      className={
        result.tone === "success"
          ? "flex items-center gap-2 rounded-lg border border-success/25 bg-success-muted px-3 py-2 text-sm text-success"
          : "rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive"
      }
    >
      {result.tone === "success" && <Check className="h-4 w-4" aria-hidden="true" />}
      {result.message}
    </div>
  );
}

export function ProfileForms({
  initialValues,
}: {
  initialValues: { name: string; title: string; email: string };
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [profilePending, startProfileTransition] = useTransition();
  const [passwordPending, startPasswordTransition] = useTransition();
  const [profileResult, setProfileResult] = useState<Result>(null);
  const [passwordResult, setPasswordResult] = useState<Result>(null);

  function submitProfile(formData: FormData) {
    setProfileResult(null);
    startProfileTransition(async () => {
      const result = await updateOwnProfile({
        name: formData.get("name"),
        title: formData.get("title"),
        email: formData.get("email"),
      });
      setProfileResult({ tone: result.ok ? "success" : "error", message: result.message });
      if (result.ok) router.refresh();
    });
  }

  function submitPassword(formData: FormData) {
    setPasswordResult(null);
    startPasswordTransition(async () => {
      const result = await changeOwnPassword({
        currentPassword: formData.get("currentPassword"),
        newPassword: formData.get("newPassword"),
        confirmPassword: formData.get("confirmPassword"),
      });
      setPasswordResult({ tone: result.ok ? "success" : "error", message: result.message });
      if (result.ok) {
        const form = document.getElementById("password-form") as HTMLFormElement | null;
        form?.reset();
      }
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{t("profile.personalTitle")}</CardTitle>
          <CardDescription>{t("profile.personalDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={submitProfile} className="space-y-5">
            <FormResult result={profileResult} />
            <div className="space-y-2">
              <Label htmlFor="name">{t("profile.name")}</Label>
              <Input id="name" name="name" defaultValue={initialValues.name} required maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">{t("profile.titleLabel")}</Label>
              <Input id="title" name="title" defaultValue={initialValues.title} required maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t("profile.email")}</Label>
              <Input id="email" name="email" type="email" defaultValue={initialValues.email} required autoComplete="email" />
            </div>
            <Button type="submit" disabled={profilePending}>
              {profilePending && <Loader2 className="h-4 w-4 animate-spin" />}
              {profilePending ? t("common.saving") : t("profile.saveProfile")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{t("profile.securityTitle")}</CardTitle>
          <CardDescription>{t("profile.securityDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form id="password-form" action={submitPassword} className="space-y-5">
            <FormResult result={passwordResult} />
            <div className="space-y-2">
              <Label htmlFor="currentPassword">{t("profile.currentPassword")}</Label>
              <Input id="currentPassword" name="currentPassword" type="password" required autoComplete="current-password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">{t("profile.newPassword")}</Label>
              <Input id="newPassword" name="newPassword" type="password" required minLength={10} autoComplete="new-password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t("profile.confirmPassword")}</Label>
              <Input id="confirmPassword" name="confirmPassword" type="password" required minLength={10} autoComplete="new-password" />
            </div>
            <p className="text-xs text-muted-foreground">{t("profile.passwordRequirements")}</p>
            <Button type="submit" disabled={passwordPending}>
              {passwordPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {passwordPending ? t("common.saving") : t("profile.changePassword")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

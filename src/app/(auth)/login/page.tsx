import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SigLogo } from "@/components/brand/sig-logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getTranslations } from "@/lib/i18n-server";

export default async function LoginPage() {
  const { t } = await getTranslations();
  return (
    <Card className="w-full max-w-md border-sig-100 shadow-lg">
      <CardHeader className="space-y-1 text-center">
        <div className="mb-2 flex justify-end">
          <LanguageSwitcher />
        </div>
        <SigLogo className="mx-auto mb-4 h-14 text-sig-700" />
        <CardTitle className="text-2xl text-sig-900">VST Calibration</CardTitle>
        <CardDescription>
          {t("login.subtitle")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </CardContent>
    </Card>
  );
}

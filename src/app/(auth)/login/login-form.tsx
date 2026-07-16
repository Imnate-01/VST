"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { ArrowRight, Eye, EyeOff, Info, Loader2, Lock, Mail } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { cn } from "@/lib/utils";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const { t } = useLanguage();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError(t("login.invalidCredentials"));
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  const fieldShell =
    "flex items-center gap-2.5 rounded-[10px] border-[1.5px] bg-white px-3.5 transition-[border-color,box-shadow] focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {/* Email */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-[12.5px] font-semibold text-foreground">
          {t("login.email")}
        </label>
        <div
          className={cn(
            fieldShell,
            error ? "border-destructive" : "border-input"
          )}
        >
          <Mail className="h-[17px] w-[17px] shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            disabled={loading}
            placeholder={t("login.emailPlaceholder")}
            aria-invalid={Boolean(error)}
            className="w-full bg-transparent py-3 text-[14.5px] text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
          />
        </div>
      </div>

      {/* Password */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="text-[12.5px] font-semibold text-foreground">
            {t("login.password")}
          </label>
          <a
            href="#account-help"
            className="text-[12.5px] font-medium text-primary underline-offset-4 hover:underline"
          >
            {t("login.forgotPassword")}
          </a>
        </div>
        <div
          className={cn(
            fieldShell,
            error ? "border-destructive" : "border-input"
          )}
        >
          <Lock className="h-[17px] w-[17px] shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            disabled={loading}
            placeholder={t("login.passwordPlaceholder")}
            aria-invalid={Boolean(error)}
            className="w-full bg-transparent py-3 text-[14.5px] text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
          />
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            className="flex shrink-0 items-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:text-foreground"
            aria-label={showPassword ? t("login.hidePassword") : t("login.showPassword")}
          >
            {showPassword ? (
              <EyeOff className="h-[18px] w-[18px]" aria-hidden="true" />
            ) : (
              <Eye className="h-[18px] w-[18px]" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="text-sm font-medium text-destructive" role="alert">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-1 flex w-full items-center justify-center gap-2 rounded-[10px] bg-primary px-4 py-3.5 text-[15px] font-semibold text-primary-foreground shadow-[0_8px_18px_-8px_hsl(var(--primary)/0.6)] transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : null}
        {t("login.submit")}
        {!loading ? <ArrowRight className="h-[17px] w-[17px]" aria-hidden="true" /> : null}
      </button>

      <div
        id="account-help"
        className="flex items-start gap-2.5 border-t pt-4 text-[12.5px] leading-relaxed text-muted-foreground"
      >
        <Info className="mt-0.5 h-[15px] w-[15px] shrink-0 text-muted-foreground" aria-hidden="true" />
        <span>{t("login.accountHelp")}</span>
      </div>
    </form>
  );
}

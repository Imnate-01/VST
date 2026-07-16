import { Suspense } from "react";
import { Check } from "lucide-react";
import { LoginForm } from "./login-form";
import { SigLogo } from "@/components/brand/sig-logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getTranslations } from "@/lib/i18n-server";

export default async function LoginPage() {
  const { t } = await getTranslations();

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-4 sm:p-8">
      <div className="grid w-full max-w-[1160px] overflow-hidden rounded-[20px] border bg-white shadow-[0_24px_60px_-30px_rgba(28,32,54,0.35)] lg:min-h-[720px] lg:grid-cols-2">
        {/* ===== FORM SIDE ===== */}
        <div className="flex flex-col p-8 sm:p-12">
          <header className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[9px] border bg-white">
                <SigLogo className="h-6 max-w-9" />
              </div>
              <span className="technical-id text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                VST · Field Service
              </span>
            </div>
            <LanguageSwitcher />
          </header>

          <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center gap-6 py-10">
            <div className="flex flex-col gap-2">
              <span className="eyebrow text-primary">{t("login.eyebrow")}</span>
              <h1 className="text-[2rem] font-extrabold leading-[1.05] tracking-[-0.03em]">
                {t("login.heading")}
              </h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t("login.description")}
              </p>
            </div>

            <Suspense fallback={null}>
              <LoginForm />
            </Suspense>
          </div>

          <p className="technical-id text-[10.5px] text-muted-foreground/60">
            © SIG · Vapor Sterilant Technology™
          </p>
        </div>

        {/* ===== BRAND SIDE ===== */}
        <aside
          className="relative hidden flex-col justify-between overflow-hidden p-10 lg:flex"
          style={{
            background:
              "radial-gradient(120% 90% at 80% 0%,#2C3568 0%,#1D2450 55%,#161B3C 100%)",
            backgroundColor: "#1D2450",
          }}
          aria-label={t("login.visualLabel")}
        >
          {/* grid overlay */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px)",
              backgroundSize: "38px 38px",
              maskImage:
                "radial-gradient(120% 100% at 70% 20%,#000 40%,transparent 100%)",
              WebkitMaskImage:
                "radial-gradient(120% 100% at 70% 20%,#000 40%,transparent 100%)",
            }}
          />

          {/* top badge */}
          <div className="relative inline-flex self-start items-center gap-2 rounded-full border border-white/20 bg-white/[0.06] px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[#C7CBE6]">
            <span className="technical-id h-[7px] w-[7px] rounded-full bg-[#5BE0A3] shadow-[0_0_0_3px_rgba(91,224,163,0.25)]" />
            {t("login.badge")}
          </div>

          {/* certificate preview card */}
          <div className="relative mx-auto w-[300px] -rotate-2 rounded-[14px] bg-white p-5 shadow-[0_30px_60px_-24px_rgba(0,0,0,0.55)]">
            <div className="mb-3.5 flex items-center justify-between gap-2.5">
              <div className="flex flex-col gap-0.5">
                <span className="technical-id text-[8px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {t("login.previewTitle")}
                </span>
                <span className="text-sm font-bold tracking-tight text-foreground">
                  SureFill 100 filler
                </span>
              </div>
              <span className="inline-flex items-center gap-1 rounded-md border border-[#BEDCC9] bg-[#F1F7F3] px-1.5 py-1 text-[9px] font-bold text-[#1F7A4D]">
                <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden="true" />
                PASS
              </span>
            </div>
            <div className="mb-3.5 grid grid-cols-3 gap-1.5">
              <div className="flex flex-col gap-0.5 rounded-lg border border-[#BEDCC9] bg-[#F1F7F3] px-2 py-2">
                <span className="text-[8px] font-semibold text-[#1F7A4D]">Temp</span>
                <span className="text-[13px] font-bold text-[#1F7A4D]">3/3</span>
              </div>
              <div className="flex flex-col gap-0.5 rounded-lg border border-[#BEDCC9] bg-[#F1F7F3] px-2 py-2">
                <span className="text-[8px] font-semibold text-[#1F7A4D]">Press</span>
                <span className="text-[13px] font-bold text-[#1F7A4D]">3/3</span>
              </div>
              <div className="flex flex-col gap-0.5 rounded-lg border border-[#EDC4BF] bg-[#FBF0EF] px-2 py-2">
                <span className="text-[8px] font-semibold text-[#B42318]">Vac</span>
                <span className="text-[13px] font-bold text-[#B42318]">2/3</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="h-[7px] w-full rounded bg-muted" />
              <div className="h-[7px] w-4/5 rounded bg-muted" />
              <div className="h-[7px] w-[92%] rounded bg-muted" />
            </div>
            <div className="mt-3.5 flex items-center justify-between border-t pt-3">
              <span className="text-[17px] italic text-primary" style={{ fontFamily: "cursive" }}>
                Carlo Costa
              </span>
              <span className="technical-id text-[8px] font-medium text-muted-foreground/70">
                SHA e7c4…91a0
              </span>
            </div>
          </div>

          {/* bottom message */}
          <div className="relative flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <div className="text-[21px] font-bold leading-tight tracking-tight text-white">
                {t("login.evidenceTitle")}
              </div>
              <div className="max-w-[360px] text-[13.5px] leading-relaxed text-[#B7BCDC]">
                {t("login.evidenceDescription")}
              </div>
            </div>
            <div className="flex gap-6 border-t border-white/10 pt-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-lg font-extrabold text-white">100%</span>
                <span className="technical-id text-[10px] font-medium text-[#8B90B8]">
                  {t("login.statTraceable")}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-lg font-extrabold text-white">ISO 17025</span>
                <span className="technical-id text-[10px] font-medium text-[#8B90B8]">
                  {t("login.statAligned")}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-lg font-extrabold text-white">e-Sign</span>
                <span className="technical-id text-[10px] font-medium text-[#8B90B8]">
                  {t("login.statVerified")}
                </span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

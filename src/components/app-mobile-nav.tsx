"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Building2,
  Cpu,
  FileText,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Menu,
  SearchCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { SigLogo } from "@/components/brand/sig-logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import type { SessionUser } from "@/components/app-sidebar";
import { useLanguage } from "@/components/language-provider";
import { cn } from "@/lib/utils";
import {
  clearOfflineSessionData,
  pendingOfflineOperationCount,
} from "@/lib/offline/session";

function mobileNavLinkClass(active: boolean) {
  return cn(
    "relative flex min-h-12 items-center gap-3 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors",
    active
      ? "border-primary/15 bg-primary/5 text-foreground before:absolute before:-left-px before:h-7 before:w-1 before:rounded-full before:bg-primary"
      : "border-transparent text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground"
  );
}

export function AppMobileNav({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const initials = (user.name ?? "SIG")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const nav = [
    { href: "/dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
    { href: "/reports", label: t("nav.reports"), icon: FileText },
    { href: "/profile", label: t("nav.profile"), icon: UserRound },
  ];
  const adminNav = [
    { href: "/admin/users", label: t("nav.users"), icon: Users },
    { href: "/admin/devices", label: t("nav.deviceCatalog"), icon: Cpu },
    { href: "/admin/standards", label: t("nav.standardInstruments"), icon: FlaskConical },
    { href: "/admin/fillers", label: t("nav.fillersClients"), icon: Building2 },
    { href: "/admin/audit", label: t("nav.audit"), icon: SearchCheck },
  ];

  const handleSignOut = async () => {
    const pending = await pendingOfflineOperationCount();
    if (pending > 0 && !window.confirm(t("offline.signOutPendingConfirm"))) {
      return;
    }
    await clearOfflineSessionData();
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <header className="sticky top-0 z-40 flex min-h-16 items-center justify-between gap-3 border-b bg-white/95 px-4 py-2 backdrop-blur md:hidden">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-input bg-white">
            <SigLogo className="h-6 max-w-8" />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-semibold text-foreground">VST Calibration</div>
            <div className="technical-id mt-0.5 truncate text-[10px] text-muted-foreground">
              {t("nav.fieldService")}
            </div>
          </div>
        </Link>

        <Dialog.Trigger asChild>
          <Button
            variant="outline"
            size="icon"
            aria-label={t("nav.openMenu")}
            aria-expanded={open}
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </Button>
        </Dialog.Trigger>
      </header>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[1px] md:hidden" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-[min(88vw,22rem)] flex-col border-l bg-white shadow-2xl focus:outline-none md:hidden">
          <div className="flex min-h-20 items-center justify-between gap-3 border-b px-5">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-semibold text-foreground">
                {t("nav.menu")}
              </Dialog.Title>
              <Dialog.Description className="sr-only">
                {t("nav.menuDescription")}
              </Dialog.Description>
              <p className="technical-id mt-0.5 truncate text-[10px] text-muted-foreground">
                VST Calibration · {t("nav.fieldService")}
              </p>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label={t("nav.closeMenu")}>
                <X className="h-5 w-5" aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>

          <nav className="flex-1 overflow-y-auto p-4" aria-label={t("nav.menu")}>
            <div className="space-y-1">
              {nav.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;

                return (
                  <Dialog.Close asChild key={item.href}>
                    <Link
                      href={item.href}
                      className={mobileNavLinkClass(active)}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon
                        className={cn("h-5 w-5 shrink-0", active && "text-primary")}
                        aria-hidden="true"
                      />
                      {item.label}
                    </Link>
                  </Dialog.Close>
                );
              })}
            </div>

            {user.role === "ADMIN" && (
              <div className="mt-7 border-t pt-5">
                <div className="eyebrow mb-2 px-4">{t("nav.admin")}</div>
                <div className="space-y-1">
                  {adminNav.map((item) => {
                    const active = pathname.startsWith(item.href);
                    const Icon = item.icon;

                    return (
                      <Dialog.Close asChild key={item.href}>
                        <Link
                          href={item.href}
                          className={mobileNavLinkClass(active)}
                          aria-current={active ? "page" : undefined}
                        >
                          <Icon
                            className={cn("h-5 w-5 shrink-0", active && "text-primary")}
                            aria-hidden="true"
                          />
                          {item.label}
                        </Link>
                      </Dialog.Close>
                    );
                  })}
                </div>
              </div>
            )}
          </nav>

          <div className="border-t p-4">
            <LanguageSwitcher className="mb-4 justify-between rounded-xl border bg-muted/35 px-3 py-2" />
            <div className="flex items-center gap-3">
              <div className="technical-id flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-sm font-semibold">
                {initials}
              </div>
              <div className="min-w-0 flex-1 text-sm">
                <div className="truncate font-semibold">{user.name}</div>
                <div className="truncate text-xs text-muted-foreground">{user.title}</div>
                <div className="technical-id mt-0.5 truncate text-[11px] text-muted-foreground/70">
                  {user.email}
                </div>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => void handleSignOut()}
                aria-label={t("nav.signOut")}
                title={t("nav.signOut")}
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

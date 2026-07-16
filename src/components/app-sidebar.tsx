"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  ChevronLeft,
  ChevronRight,
  Building2,
  Cpu,
  FileText,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  SearchCheck,
  UserRound,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SigLogo } from "@/components/brand/sig-logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLanguage } from "@/components/language-provider";

type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  role: "ENGINEER" | "ADMIN";
  title: string;
};

function navLinkClass(active: boolean) {
  return cn(
    "relative flex min-h-12 items-center gap-3 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors",
    active
      ? "border-transparent bg-muted text-foreground before:absolute before:-left-px before:h-7 before:w-1 before:rounded-full before:bg-primary"
      : "border-transparent text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground"
  );
}

export function AppSidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [collapsed, setCollapsed] = useState(false);
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

  return (
    <aside
      className={cn(
        "hidden shrink-0 border-r bg-white transition-[width] duration-200 md:flex md:flex-col",
        collapsed ? "md:w-24" : "md:w-72"
      )}
    >
      <div className="flex min-h-24 items-center gap-3 border-b p-5">
        <Link href="/dashboard" className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-input bg-white">
            <SigLogo className="h-7 max-w-10" />
          </div>
          {!collapsed && (
            <div className="min-w-0 text-sm leading-tight">
              <div className="truncate font-semibold text-foreground">VST Calibration</div>
              <div className="technical-id mt-1 truncate text-xs text-muted-foreground">
                {t("nav.fieldService")}
              </div>
            </div>
          )}
        </Link>
        {!collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-input text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            aria-label={t("nav.collapse")}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {nav.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(navLinkClass(active), collapsed && "justify-center px-3")}
              title={collapsed ? item.label : undefined}
            >
              <Icon className={cn("h-5 w-5 shrink-0", active && "text-primary")} />
              {!collapsed && item.label}
            </Link>
          );
        })}

        {user.role === "ADMIN" && (
          <div className="space-y-1 pt-7">
            {adminNav.map((item) => {
              const active = pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(navLinkClass(active), collapsed && "justify-center px-3")}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className={cn("h-5 w-5 shrink-0", active && "text-primary")} />
                  {!collapsed && item.label}
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      <div className="border-t p-4">
        {collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="mb-3 flex h-10 w-full items-center justify-center rounded-lg border border-input text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            aria-label={t("nav.expand")}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        {!collapsed && <LanguageSwitcher className="mb-4" />}
        <div className={cn("flex items-center gap-3", collapsed && "flex-col")}>
          <div className="technical-id flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-sm font-semibold">
            {initials}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1 text-sm">
              <div className="truncate font-semibold">{user.name}</div>
              <div className="truncate text-xs text-muted-foreground">{user.title}</div>
              <div className="technical-id mt-0.5 truncate text-[11px] text-muted-foreground/70">
                {user.email}
              </div>
            </div>
          )}
          <Button
            variant="outline"
            size={collapsed ? "icon" : "sm"}
            className="h-10 w-10 px-0"
            onClick={() => signOut({ callbackUrl: "/login" })}
            aria-label={t("nav.signOut")}
            title={t("nav.signOut")}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}

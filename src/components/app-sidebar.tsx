"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { FileText, LayoutDashboard, Settings, LogOut } from "lucide-react";
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
    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
    active
      ? "bg-sig-700 text-white shadow-sm"
      : "text-slate-600 hover:bg-sig-50 hover:text-sig-800"
  );
}

export function AppSidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const nav = [
    { href: "/dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
    { href: "/reports", label: t("nav.reports"), icon: FileText },
  ];
  const adminNav = [{ href: "/admin", label: t("nav.admin"), icon: Settings }];

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col border-r border-sig-100 bg-white">
      <div className="border-b border-sig-100 bg-gradient-to-b from-sig-50 to-white p-6">
        <Link href="/dashboard" className="flex items-center gap-3">
          <SigLogo className="h-9 text-sig-700" />
          <div className="text-sm leading-tight">
            <div className="font-semibold text-sig-900">VST Calibration</div>
            <div className="text-xs text-muted-foreground">{t("nav.fieldService")}</div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {nav.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={navLinkClass(active)}>
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}

        {user.role === "ADMIN" &&
          adminNav.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={navLinkClass(active)}>
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
      </nav>

      <div className="border-t p-4 space-y-3">
        <LanguageSwitcher />
        <div className="text-sm">
          <div className="font-medium truncate">{user.name}</div>
          <div className="text-xs text-muted-foreground truncate">
            {user.title}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {user.email}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-4 w-4" />
          {t("nav.signOut")}
        </Button>
      </div>
    </aside>
  );
}

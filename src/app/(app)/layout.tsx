import { requireAuth } from "@/server/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { AppMobileNav } from "@/components/app-mobile-nav";
import { OfflineBanner } from "@/components/offline/offline-banner";
import { InstallPrompt } from "@/components/offline/install-prompt";
import { OfflineIdentity } from "@/components/offline/offline-identity";
import { OfflineSync } from "@/components/offline/offline-sync";
import { OfflineStorage } from "@/components/offline/offline-storage";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth();

  return (
    <div className="flex min-h-screen bg-muted/35">
      <AppSidebar user={session.user} />
      <main className="min-w-0 flex-1 overflow-x-hidden">
        <OfflineBanner />
        <OfflineStorage />
        <AppMobileNav user={session.user} />
        <div className="container max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          {children}
        </div>
      </main>
      <InstallPrompt />
      <OfflineIdentity />
      <OfflineSync />
    </div>
  );
}

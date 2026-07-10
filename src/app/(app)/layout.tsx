import { requireAuth } from "@/server/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { LanguageSwitcher } from "@/components/language-switcher";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth();

  return (
    <div className="min-h-screen flex">
      <AppSidebar user={session.user} />
      <main className="flex-1 overflow-x-hidden">
        <div className="flex justify-end border-b bg-white px-4 py-3 md:hidden">
          <LanguageSwitcher />
        </div>
        <div className="container max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}

import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { getLocale } from "@/lib/i18n-server";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: "VST Calibration Reports",
    description:
      locale === "es"
        ? "Reportes de calibración de servicio de campo para sistemas de esterilización VST"
        : "Field Service Calibration Reports for VST Sterilization Systems",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();

  return (
    <html lang={locale}>
      <body className="antialiased">
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";
import { getLocale } from "@/lib/i18n-server";
import "./globals.css";

const THEME_COLOR = "#1258FD";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const description =
    locale === "es"
      ? "Reportes de calibración de servicio de campo para sistemas de esterilización VST"
      : "Field Service Calibration Reports for VST Sterilization Systems";
  return {
    applicationName: "VST Calibration",
    title: "VST Calibration Reports",
    description,
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "VST Calib",
    },
    icons: {
      icon: "/icon-192.png",
      apple: "/apple-touch-icon.png",
    },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: THEME_COLOR,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

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

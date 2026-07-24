import type { MetadataRoute } from "next";

/**
 * Manifest de la PWA. El arranque apunta a /dashboard (ruta autenticada); si no
 * hay sesión, el middleware redirige a /login estando online. Los iconos PNG
 * cubren instalabilidad en Chromium; apple-touch-icon.png cubre iOS.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VST Calibration Reports",
    short_name: "VST Calib",
    description:
      "Reportes de calibración de servicio de campo para sistemas de esterilización VST. Funciona sin conexión.",
    id: "/",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#ffffff",
    theme_color: "#1258FD",
    categories: ["business", "productivity", "utilities"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

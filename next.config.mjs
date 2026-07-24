import withSerwistInit from "@serwist/next";

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
};

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // El SW se desactiva en desarrollo por defecto para no interferir con HMR.
  // Para probar offline en dev, arranca con DISABLE_PWA=false.
  disable: process.env.NODE_ENV === "development" && process.env.DISABLE_PWA !== "false",
  reloadOnOnline: true,
});

export default withSerwist(nextConfig);

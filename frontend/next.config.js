/** @type {import('next').NextConfig} */

// Opt-in static export, used only to publish the standalone /survey page to
// GitHub Pages (see scripts/export-survey-static.sh). Normal `next build`
// runs are completely unaffected — output stays the default hybrid mode
// unless STATIC_EXPORT=true is set.
const isStaticExport = process.env.STATIC_EXPORT === "true";
const basePath = process.env.STATIC_EXPORT_BASE_PATH || "";

const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  ...(isStaticExport
    ? {
        output: "export",
        basePath,
        assetPrefix: basePath ? `${basePath}/` : undefined,
      }
    : {}),
};

module.exports = nextConfig;

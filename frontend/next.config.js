/** @type {import('next').NextConfig} */

// Step 16 — ported from the unmerged survey branch. Opt-in static export,
// used only to publish the standalone /survey page to GitHub Pages (see
// scripts/export-survey-static.sh, and the antarasurvey repo that actually
// serves survey.antara.money from that export's output). Normal `next
// build`/`next start` runs (the real app, app.antara.money) are completely
// unaffected — output stays the default hybrid mode unless STATIC_EXPORT=true
// is set.
const isStaticExport = process.env.STATIC_EXPORT === "true";
const basePath = process.env.STATIC_EXPORT_BASE_PATH || "";

const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  // `output: "export"` and `rewrites()` are mutually exclusive in Next.js
  // (a static export has no server to rewrite through) — the rewrite below
  // only matters for the real running app anyway, never for the exported
  // /survey page, so it's omitted rather than causing a build failure the
  // one time someone actually runs a STATIC_EXPORT build.
  ...(isStaticExport
    ? {
        output: "export",
        basePath,
        assetPrefix: basePath ? `${basePath}/` : undefined,
      }
    : {
        async rewrites() {
          return [
            { source: "/api/v1/:path*", destination: "http://127.0.0.1:8001/api/v1/:path*" },
          ];
        },
      }),
};

module.exports = nextConfig;

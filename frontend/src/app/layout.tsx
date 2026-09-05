import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";
import { AppBootGate } from "@/components/AppBootGate";

// Brief 5 (2026-09-05): self-hosted Umami — aggregate-only, no third-party
// ad-tech SDK, no per-user behavioural profile (see REVIEW.md for why
// that's deliberate for an app used by minors). Self-hosted at
// stats.antara.money (this box, behind the same Cloudflare tunnel
// app.antara.money/api.antara.money already use), not the umami.is cloud
// service — the script never leaves infrastructure this project already
// controls. Website id comes from NEXT_PUBLIC_UMAMI_WEBSITE_ID, set in
// frontend/.env.local (gitignored, not in this repo — see REVIEW.md for
// the actual value); left unset, this component renders nothing, so local
// dev and any future redeploy that drops this var simply has no tracking
// rather than an error.
const UMAMI_WEBSITE_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;

export const metadata: Metadata = {
  title: "Antara — Expense Logging & ML Spend-Prediction for Indian Teens",
  description: "High-velocity personal finance and spend behavior graph for Indian teenagers.",
  manifest: "/manifest.json",
  // Step 11: real brand assets, replacing Next.js's default favicon (there
  // was no icons config here at all before this — confirmed by checking:
  // no favicon.ico/icon.* anywhere in src/app/, nothing in public/, no
  // metadata.icons). See frontend/public/brand/ for the source SVG and every
  // generated size.
  icons: {
    icon: [
      { url: "/brand/favicon.ico", sizes: "any" },
      { url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/brand/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Brief 6 (2026-09-05): the Google Fonts <link> that used to load
            Inter from here is gone — IBM Plex Sans/Mono are self-hosted
            under public/fonts/ and declared via @font-face in
            globals.css. One less third-party request, one less party
            (Google's font CDN) seeing every visitor's IP on page load. */}
        {UMAMI_WEBSITE_ID && (
          <Script
            src="https://stats.antara.money/script.js"
            data-website-id={UMAMI_WEBSITE_ID}
            strategy="afterInteractive"
          />
        )}
      </head>
      <body className="bg-[#060709] antialiased">
        <AuthProvider>
          <AppBootGate>{children}</AppBootGate>
        </AuthProvider>
      </body>
    </html>
  );
}

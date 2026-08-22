import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";
import { AppBootGate } from "@/components/AppBootGate";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { APPLE_SPLASH_SCREENS } from "@/lib/appleSplashScreens";

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
  // Step 17: iOS "Add to Home Screen" support. `capable: true` is what
  // actually removes Safari's chrome on launch (the standalone-display
  // manifest field alone does nothing on iOS — that's an Android/Chrome-only
  // read); `statusBarStyle: "black-translucent"` lets the app's own
  // near-black background (#0A0C10) show through the status bar area
  // instead of Safari's default white-on-white bar, matching the dark
  // theme; `startupImage` is what kills the blank-white-flash between tap
  // and first paint — without it iOS shows a plain white screen for however
  // long hydration takes, regardless of how dark the app itself is. Each
  // entry below is a real PNG (see appleSplashScreens.ts / generate step),
  // logo mark centered on the same #0A0C10 the app actually renders on, not
  // a placeholder or a stretched icon.
  appleWebApp: {
    capable: true,
    title: "Antara",
    statusBarStyle: "black-translucent",
    startupImage: APPLE_SPLASH_SCREENS,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  // Matches manifest.json's theme_color / MobileFrame's actual inner
  // background — keeps Safari/Chrome's own chrome (address bar, app
  // switcher card) dark instead of defaulting to white.
  themeColor: "#0A0C10",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#060709] antialiased">
        <ServiceWorkerRegister />
        <AuthProvider>
          <AppBootGate>{children}</AppBootGate>
        </AuthProvider>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";
import { AppBootGate } from "@/components/AppBootGate";

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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#060709] antialiased">
        <AuthProvider>
          <AppBootGate>{children}</AppBootGate>
        </AuthProvider>
      </body>
    </html>
  );
}

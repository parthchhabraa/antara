"use client";

import { useEffect } from "react";

// Step 17 — registers the app-shell service worker (public/service-worker.js).
// Client-only, no UI: `navigator.serviceWorker` doesn't exist during SSR or
// in unsupported browsers, so this no-ops rather than throwing there.
// Deliberately silent on failure (console.warn only) — a failed SW
// registration must never block the app itself from rendering.
export const ServiceWorkerRegister: React.FC = () => {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/service-worker.js").catch((err) => {
      console.warn("Service worker registration failed:", err);
    });
  }, []);
  return null;
};

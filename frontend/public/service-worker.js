// Step 17 — minimal app-shell service worker.
//
// Scope, deliberately: this caches the STATIC SHELL ONLY — the HTML
// navigation response and hashed Next.js build assets (JS/CSS/fonts/brand
// images) — so that an installed home-screen launch with no network shows
// the app's own UI instead of Safari's flat "You Are Not Connected to the
// Internet" page. It never caches or intercepts:
//   - anything under /api/ (the ML backend), or
//   - anything cross-origin (Firestore/Auth's own requests to
//     googleapis.com), or
//   - any non-GET request.
// So a real transaction write, a live Firestore onSnapshot update, and an
// ML prediction call always hit the real network, never a stale cached
// response — this app is not silently serving old financial numbers as if
// live. Full offline transaction queueing/sync (writing while offline,
// reconciling later) is explicitly NOT built here — see REVIEW.md for why.
//
// Cache-busting: bump CACHE_NAME whenever this file's caching behavior
// changes; the old cache is deleted on activate.
const CACHE_NAME = "antara-shell-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isCacheableStaticAsset(url) {
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/api/")) return false;
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/brand/") ||
    url.pathname === "/manifest.json" ||
    url.pathname === "/favicon.ico"
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Live API calls and anything cross-origin (Firestore/Auth) pass straight
  // through — never intercepted, never cached.
  if (url.pathname.startsWith("/api/")) return;
  if (url.origin !== self.location.origin) return;

  // HTML navigations (opening/reopening the installed app): network-first
  // so signed-in users always see fresh content when online, falling back
  // to the last cached shell only when the network request itself fails —
  // this is what removes the white blank-page gap when offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match("/")))
    );
    return;
  }

  // Hashed static build assets + brand images: cache-first. Content-hashed
  // filenames are immutable (a code change ships under a new filename), so
  // once cached there's never a reason to re-fetch the same URL.
  if (isCacheableStaticAsset(url)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          return res;
        });
      })
    );
  }
});

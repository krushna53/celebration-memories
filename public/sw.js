// Minimal, deliberately non-caching service worker.
//
// Its only job is to satisfy the "has a registered service worker"
// installability criterion some browsers still check before offering
// the "Install app" / "Add to Home Screen" prompt for a PWA. It does
// NOT cache anything and does NOT intercept fetches (no
// event.respondWith() call below) — every request just falls through
// to the network exactly as if no service worker existed at all.
//
// This is intentional: an offline-caching service worker is a real
// way to accidentally serve a stale/broken copy of the site to an
// installed user after a deploy. Given this app is a fully dynamic
// Next.js site (Server Actions, cookies, live Supabase data — nothing
// here is safe to cache blindly), "installable but always fetches
// fresh from the network" is the correct trade-off, not a real
// offline-first PWA. Revisit only with a carefully scoped cache
// strategy (e.g. static assets only) if true offline support is ever
// wanted.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Intentionally empty — no respondWith(), so the browser handles
  // every request normally via the network.
});

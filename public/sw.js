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

// --- Guest reminder push notifications ---------------------------------
//
// Handles incoming Web Push messages (sent server-side by
// supabase/functions/send-reminder-push, e.g. "you started a video —
// want to finish it?") and taps on the resulting notification. This is
// the only part of this file that does real work; everything above
// stays a deliberately non-caching pass-through — see this file's own
// top comment.
//
// Payload shape sent by the Edge Function: { title, body, url, tag }.
// Falls back to generic text if the payload is missing/malformed so a
// push never silently does nothing.
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    if (event.data) payload = event.data.json();
  } catch {
    // Non-JSON payload — fall through to the generic defaults below.
  }

  const title = payload.title || "EveryMoment";
  const options = {
    body: payload.body || "You have an unfinished memory to upload.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: payload.tag || "guest-reminder",
    data: { url: payload.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Tapping the notification focuses an already-open tab on the target
// URL if one exists, otherwise opens a new one — standard PWA
// notification-click pattern.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    }),
  );
});

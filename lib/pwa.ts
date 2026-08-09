/**
 * Shared PWA-install-state helper — was previously duplicated inline in
 * features/pwa/install-app-banner.tsx; now also used by
 * features/push/engagement-opt-in-banner.tsx, which needs to know "is
 * this guest running the installed app right now" to decide whether to
 * offer general event-update notifications (see that file's doc
 * comment for why this gate matters).
 */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const navigatorStandalone = (navigator as Navigator & { standalone?: boolean }).standalone;
  return window.matchMedia("(display-mode: standalone)").matches || navigatorStandalone === true;
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !("MSStream" in window);
}

/**
 * Whether Web Push can actually work right now, given the platform's
 * real constraints — not just API feature-detection (which reports
 * true even where it doesn't work). iOS Safari exposes the
 * Notification/PushManager/serviceWorker APIs since 16.4, but Apple
 * hard-blocks actually requesting permission or subscribing unless the
 * site is running installed (standalone) — a plain Safari tab visitor
 * on iPhone cannot receive push notifications at all, no matter what
 * this app does. Every other supported platform (Android/Chrome,
 * desktop browsers) works fine in a normal tab, no install required.
 */
export function canRequestPushNow(): boolean {
  if (isIOS()) return isStandalone();
  return true;
}

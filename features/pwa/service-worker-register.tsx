"use client";

import { useEffect } from "react";

/**
 * Registers public/sw.js (a deliberately non-caching service worker —
 * see that file's doc comment) site-wide. Client Component mounted
 * once from the root layout, same pattern as
 * features/analytics/clarity-script.tsx. Feature-detected
 * (`"serviceWorker" in navigator`) so this is a no-op on browsers
 * without support rather than throwing.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Service worker registration failed:", err);
    });
  }, []);

  return null;
}

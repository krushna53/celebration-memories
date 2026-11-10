"use client";

import { createContext, useContext, useEffect, useSyncExternalStore } from "react";

/**
 * An event page without EveryMoment's own footer or "Install the app"
 * prompt (events.hide_platform_branding). EventLandingPage wraps the
 * template in PlatformChromeProvider, so every template's SiteShell
 * footer hides through context without each template passing a prop.
 */
const HiddenContext = createContext(false);

// The install banner is mounted in the root layout, outside the event page's tree, so it hears through this store.
let suppressors = 0;
const listeners = new Set<() => void>();
function changeSuppressors(delta: number) {
  suppressors += delta;
  listeners.forEach((listener) => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** True while an event page that hides the platform's chrome is on screen. */
export function useInstallBannerSuppressed(): boolean {
  return useSyncExternalStore(subscribe, () => suppressors > 0, () => false);
}

export function PlatformChromeProvider({ hidden, children }: { hidden: boolean; children: React.ReactNode }) {
  useEffect(() => {
    if (!hidden) return;
    changeSuppressors(1);
    return () => changeSuppressors(-1);
  }, [hidden]);
  return <HiddenContext.Provider value={hidden}>{children}</HiddenContext.Provider>;
}

/** Renders the site footer unless the event page hides the platform's chrome. */
export function PlatformFooter({ children }: { children: React.ReactNode }) {
  return useContext(HiddenContext) ? null : children;
}

import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Wraps the live deployed site (Netlify) in a native iOS/Android shell,
 * rather than bundling a static export of the Next.js build.
 *
 * This app is fully dynamic — Server Actions, Server Components,
 * cookie-based Supabase Auth sessions, live database reads on every
 * request (admin dashboard, RSVP, Memory Wall, the Video Editor, the
 * business marketplace, etc.). None of that survives `next export`
 * (which only works for fully static sites), so the correct Capacitor
 * pattern here is "remote URL" mode: the native shell's WebView just
 * loads the real production site, the same way Capacitor is documented
 * to support for server-rendered apps. Every existing feature —
 * including /admin — works as-is with zero duplication, and the app
 * always reflects whatever is currently deployed; there's no separate
 * "mobile build" to keep in sync.
 *
 * webDir points at public/ purely to satisfy Capacitor's config schema
 * (it requires *some* directory to exist) — it's never actually served,
 * since server.url below takes over entirely.
 *
 * Set NEXT_PUBLIC_SITE_URL / update the fallback in lib/constants.ts if
 * the production domain ever changes; this reads the same constant so
 * the two never drift apart.
 */
const PRODUCTION_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://everymoment.me";

const config: CapacitorConfig = {
  appId: "me.everymoment.app",
  appName: "EveryMoment",
  webDir: "public",
  server: {
    url: PRODUCTION_URL,
    // Allows the WebView to navigate to everymoment.me itself, plus
    // Supabase (auth/storage/API) and any Shotstack-served render URLs
    // the Video Editor and Slideshow features load. androidScheme
    // stays "https" (the default) — no cleartext traffic anywhere.
    allowNavigation: ["everymoment.me", "*.everymoment.me", "*.supabase.co", "*.shotstack.io", "cdn.shotstack.io"],
  },
  ios: {
    contentInset: "automatic",
  },
};

export default config;

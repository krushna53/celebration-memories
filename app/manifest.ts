import type { MetadataRoute } from "next";

import { SITE_NAME } from "@/lib/constants";

/**
 * Next.js's file-convention Web App Manifest route — auto-served at
 * /manifest.webmanifest with a <link rel="manifest"> tag injected into
 * every page's <head> automatically, no layout.tsx changes needed.
 *
 * This is what lets a guest or admin "Install app" / "Add to Home
 * Screen" from Chrome/Edge/Android and get a standalone app window
 * (no browser chrome) rather than just a bookmarked tab — the mobile
 * "app" for this platform, per the decision to wrap the existing
 * responsive site rather than rebuild it natively (see
 * capacitor.config.ts for the second half of that: native iOS/Android
 * shells around this same live site).
 *
 * Deliberately platform-generic (not tied to any one client's event
 * name), matching app/layout.tsx's own metadata reasoning — every
 * event still opens fine from within the installed app shell via its
 * own URL, this is just what the OS shows for the installed icon/app
 * itself.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — Digital Invitations & Guest Memories`,
    short_name: SITE_NAME,
    description: "Premium digital invitations and shared guest memories for any celebration.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#272257",
    theme_color: "#272257",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}

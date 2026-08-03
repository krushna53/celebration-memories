import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/constants";

/**
 * Keeps /admin, API routes, and every token-gated private URL out of
 * search indexes; everything genuinely public stays crawlable.
 *
 * The token-gated routes (/invite, /event-day, /games, /start, /plan,
 * /pay) are disallowed rather than left to a per-page `noindex` meta
 * tag on purpose — a crawler has to actually fetch a page to see a
 * noindex tag, and these URLs carry a bearer token in the path itself
 * (see the as-built CLAUDE.md's "possession of a token is the
 * credential" model). Disallowing the whole prefix means a compliant
 * crawler never requests the URL at all, so a token never ends up in
 * anyone's crawl logs. /business/dashboard is a signed-in-only vendor
 * page (nothing to index, and a crawler can't reach past the login
 * wall regardless). /pricing-legacy is superseded by /pricing and kept
 * around only for old links — excluded so it doesn't compete with the
 * canonical page for search ranking.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/admin/*",
        "/api/*",
        "/invite",
        "/invite/*",
        "/event-day",
        "/event-day/*",
        "/games",
        "/games/*",
        "/start",
        "/start/*",
        "/plan",
        "/plan/*",
        "/pay",
        "/pay/*",
        "/business/dashboard",
        "/pricing-legacy",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

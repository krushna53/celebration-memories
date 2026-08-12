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
 *
 * AI-crawler bots (GPTBot, ClaudeBot, PerplexityBot, Google-Extended,
 * CCBot, etc.) already inherit the wildcard "*" rule below — a bare
 * `allow: "/"` covers them implicitly. They're also listed out by name
 * here, with the exact same allow/disallow shape, purely to make the
 * intent explicit: this site *wants* to be readable by AI answer
 * engines and assistants (part of the "AI Tools based SEO" pass — see
 * lib/structured-data.ts for the schema.org/Event + Organization/
 * WebSite JSON-LD that gives those same crawlers structured facts
 * instead of having to infer them from prose), and a future edit that
 * narrows the wildcard rule won't silently narrow AI access too.
 */
const PUBLIC_ALLOW = "/";
const PUBLIC_DISALLOW = [
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
];

const AI_CRAWLER_USER_AGENTS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "Amazonbot",
  "CCBot",
  "Bytespider",
  "meta-externalagent",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: PUBLIC_ALLOW,
        disallow: PUBLIC_DISALLOW,
      },
      {
        userAgent: AI_CRAWLER_USER_AGENTS,
        allow: PUBLIC_ALLOW,
        disallow: PUBLIC_DISALLOW,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

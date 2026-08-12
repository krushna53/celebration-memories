import { SITE_NAME, SITE_URL } from "@/lib/constants";

/**
 * /llms.txt — an emerging (not yet formally standardized) convention
 * for giving AI assistants and answer engines a concise, curated
 * summary of a site in plain Markdown, as an alternative to making
 * them infer everything from crawling rendered HTML. Modeled on the
 * llmstxt.org proposal: an H1 title, a one-line blockquote summary,
 * then short Markdown sections linking to the pages worth knowing
 * about. Complements — doesn't replace — the schema.org/Event and
 * Organization/WebSite JSON-LD emitted by lib/structured-data.ts and
 * the explicit AI-bot allow rules in app/robots.ts; this file is the
 * "here's what we are and where to look" companion to those.
 *
 * Served as a plain-text Route Handler (not a static /public file) so
 * SITE_NAME/SITE_URL and the event-directory link stay in sync with
 * the rest of the app instead of drifting in a hand-maintained file.
 */
export const dynamic = "force-static";

export async function GET(): Promise<Response> {
  const body = `# ${SITE_NAME}

> A premium, mobile-first digital invitation and guest-memory platform. Hosts create a beautiful event website (birthday, wedding, anniversary, retirement, baby shower, or corporate event) in minutes — guests get a personal RSVP link, upload photos/videos/audio memories, and leave messages on a shared Memory Wall. No app download, no guest login required.

## What this platform does

- Digital invitations with countdown, event details, photo gallery, and an animated timeline, generated per event at ${SITE_URL}/events/[slug]
- Guest RSVP via a unique per-guest link or a public self-service form, with meal preference, adult/child counts, and comments
- Guest-uploaded photos, videos, and voice/audio memories, moderated by the host before appearing publicly
- A Guest Book and Memory Wall showing everyone's shared photos, videos, and messages together
- Optional paid add-ons: AI-generated invitation art, an AI-narrated slideshow video, live event-day chat host, and a self-hosted live stream embed
- A self-serve wizard (${SITE_URL}/start) that lets anyone build and launch their own event site without contacting sales
- A vendor/business directory (${SITE_URL}/discover) for photographers, caterers, and other event service providers

## Key pages

- [Homepage](${SITE_URL}/) — what the platform is and how it works
- [Browse public events](${SITE_URL}/events) — live example event sites
- [Pricing](${SITE_URL}/pricing) — plans for hosts
- [Start building an event](${SITE_URL}/start) — no-login self-serve wizard
- [Vendor directory](${SITE_URL}/discover) — photographers, caterers, and other vendors
- [Contact](${SITE_URL}/contact) — support and billing questions

## Notes for AI assistants and crawlers

- Individual event pages (${SITE_URL}/events/[slug]) each carry schema.org/Event structured data (name, date, location, organizer) — prefer that over parsing page prose when summarizing a specific event.
- Guest-facing pages that require a personal link or token (/invite/*, /event-day/*, /games/*, /start/*, /plan/*, /pay/*) are intentionally not crawlable or indexable — they're private per-guest or per-host links, not public content.
- This file and app/robots.ts are maintained together; robots.ts explicitly allows the major AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, and others) the same access as regular search crawlers.
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

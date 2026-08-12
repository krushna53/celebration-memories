import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { toEventDisplayData } from "@/lib/event-display";
import { EVENT_CATEGORY_LABELS } from "@/lib/event-category";
import type { EventRecord } from "@/types/event";

/**
 * schema.org JSON-LD builders — part of the "AI-tool SEO" pass. This
 * codebase previously had zero structured data anywhere (confirmed via
 * grep for application/ld+json before writing this file), which puts
 * it at a real disadvantage for both classic rich-result eligibility
 * (Google) and the newer generation of LLM-driven answer engines
 * (ChatGPT/Perplexity/Google AI Overviews/Claude web search), which
 * lean on schema.org markup much more heavily than older keyword-based
 * crawling did to understand what a page actually is without having to
 * infer it from prose.
 *
 * Each builder returns a plain object — never a string — so callers
 * decide how to serialize/inject it. Render via the <JsonLd> component
 * below (an inline <script type="application/ld+json">), which is the
 * one Next.js-recommended way to emit structured data from a Server
 * Component without a hydration mismatch.
 */

export type JsonLdObject = Record<string, unknown>;

/** Renders a schema.org object as an inline JSON-LD <script> tag. Safe against the standard "</script>" break-out issue via a narrow-scoped string replace. */
export function JsonLd({ data }: { data: JsonLdObject }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  // JSON-LD via dangerouslySetInnerHTML is the standard, Next.js-documented
  // way to emit structured data — content here is always server-generated
  // from typed fields (never raw guest input), so this is safe.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

/**
 * Platform-level identity — who EveryMoment is, as an Organization, and
 * that the site itself is a WebSite. Intended for the platform homepage
 * (app/page.tsx) only; individual events get their own Event schema
 * instead (see buildEventJsonLd).
 */
export function buildOrganizationJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    description:
      "A premium, mobile-first digital invitation and guest-memory platform for birthdays, weddings, anniversaries, retirements, baby showers, and corporate events — unique guest links, live RSVP, and a shared wall of photos, videos, and messages.",
    logo: `${SITE_URL}/icon-512.png`,
  };
}

export function buildWebsiteJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/discover?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * Per-event schema.org/Event markup for a public event page
 * (app/events/[slug]/page.tsx). Only ever built for events that are
 * already publicly reachable at that URL — this doesn't change access,
 * it just describes a page that's already public.
 */
export function buildEventJsonLd(event: EventRecord, coverImage: string | null): JsonLdObject {
  const data = toEventDisplayData(event);
  const url = `${SITE_URL}/events/${event.slug}`;
  const name = data.occasion ? `${data.honoreeName} — ${data.occasion}` : `${data.honoreeName} — ${data.eventTitle}`;
  const description = data.occasion
    ? `${data.occasion}, hosted by ${data.hostedBy}. ${data.dayOfWeek}, ${data.date} at ${data.startTime}${
        data.venueName ? ` — ${data.venueName}` : ""
      }.`
    : `Hosted by ${data.hostedBy}. ${data.dayOfWeek}, ${data.date} at ${data.startTime}${
        data.venueName ? ` — ${data.venueName}` : ""
      }.`;

  const location: JsonLdObject | undefined = data.venueName
    ? {
        "@type": "Place",
        name: data.venueName,
        address: data.venueAddress ?? undefined,
      }
    : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name,
    description,
    startDate: event.startAt,
    endDate: event.endAt,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: location ?? {
      "@type": "Place",
      name: "Venue to be announced",
    },
    image: coverImage ? [coverImage] : undefined,
    url,
    organizer: {
      "@type": "Person",
      name: data.hostedBy,
    },
    about: data.category ? EVENT_CATEGORY_LABELS[data.category] : undefined,
  };
}

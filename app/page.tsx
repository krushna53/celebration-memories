import { cache } from "react";
import type { Metadata } from "next";

import { EventLandingPage } from "@/features/event-landing/event-landing-page";
import { EVENT_SLUG } from "@/lib/constants";
import { getEventBySlug } from "@/services/events";
import { buildEventMetadata } from "@/lib/event-metadata";
import type { EventRecord } from "@/types/event";

/**
 * Primary homepage — always renders the site's main event (EVENT_SLUG).
 * Revalidated periodically (not fully static) so admin edits show up
 * without a full redeploy. See features/event-landing for the shared
 * section-assembly logic reused by /events/[slug].
 */
export const revalidate = 60;

// cache() dedupes this within a single request — generateMetadata and
// the page component both need the event, but should only fetch it once.
const loadEvent = cache(async (): Promise<EventRecord | null> => {
  try {
    return await getEventBySlug(EVENT_SLUG);
  } catch (err) {
    console.error("Homepage failed to load event data:", err);
    return null;
  }
});

export async function generateMetadata(): Promise<Metadata> {
  return buildEventMetadata(await loadEvent());
}

export default async function Home() {
  const event = await loadEvent();
  return <EventLandingPage event={event} />;
}

import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EventLandingPage } from "@/features/event-landing/event-landing-page";
import { getEventBySlug } from "@/services/events";
import { buildEventMetadata } from "@/lib/event-metadata";
import type { EventRecord } from "@/types/event";

/**
 * Generic public event page — the same "mini-site" experience as the
 * homepage (Hero → Memory Wall), but resolved by slug so any event in
 * the platform gets its own shareable URL. Works for both public and
 * private events: `visibility` only controls whether an event shows up
 * in the /events directory, not whether the page itself is reachable —
 * same trust model as a per-guest invite link.
 */
export const revalidate = 60;

interface PublicEventPageProps {
  params: Promise<{ slug: string }>;
}

const loadEvent = cache(async (slug: string): Promise<EventRecord | null> => {
  try {
    return await getEventBySlug(slug);
  } catch (err) {
    console.error("PublicEventPage failed to load event:", err);
    return null;
  }
});

export async function generateMetadata({ params }: PublicEventPageProps): Promise<Metadata> {
  const { slug } = await params;
  return buildEventMetadata(await loadEvent(slug));
}

export default async function PublicEventPage({ params }: PublicEventPageProps) {
  const { slug } = await params;
  const event = await loadEvent(slug);

  if (!event) {
    notFound();
  }

  return <EventLandingPage event={event} />;
}

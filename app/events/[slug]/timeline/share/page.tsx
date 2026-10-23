import { cache } from "react";
import { HeartHandshake } from "lucide-react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getEventBySlug } from "@/services/events";
import { getInviteeByToken } from "@/services/invitees";
import { areTimelineContributionsEnabled, listMilestoneOptions } from "@/services/timeline-contributions";
import { buildEventMetadata } from "@/lib/event-metadata";
import { TimelineShareForm } from "@/features/timeline-share/timeline-share-form";
import { Reveal } from "@/components/motion/reveal";
import { SiteShell } from "@/components/layout/site-shell";

export const dynamic = "force-dynamic";

interface TimelineSharePageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ t?: string }>;
}

const loadEvent = cache((slug: string) => getEventBySlug(slug));

export async function generateMetadata({ params }: TimelineSharePageProps): Promise<Metadata> {
  const { slug } = await params;
  const event = await loadEvent(slug);
  const base = await buildEventMetadata(event);
  return {
    ...base,
    title: event ? `Add to ${event.honoreeName}'s Timeline` : "Add to the Timeline",
    robots: { index: false },
  };
}

/**
 * Guests add photos to the Timeline — the link a host shares in WhatsApp
 * from Admin → Timeline. Only open while the host has it switched on
 * (events.timeline_contributions_enabled); every submission waits for the
 * host's approval (services/timeline-contributions.ts).
 *
 * `?t=<invite token>` (the "Add to the Timeline" card on a guest's own
 * invite page) skips the name step; anyone else types their name, same as
 * the public memories page.
 */
export default async function TimelineSharePage({ params, searchParams }: TimelineSharePageProps) {
  const { slug } = await params;
  const { t } = await searchParams;
  const event = await loadEvent(slug);
  if (!event) notFound();

  const enabled = await areTimelineContributionsEnabled(event.id);
  const guest = enabled && t ? await getInviteeByToken(t) : null;
  const ownGuest = guest && guest.event.id === event.id ? guest.invitee : null;
  const milestones = enabled ? await listMilestoneOptions(event.id) : [];

  return (
    <SiteShell honoreeName={event.honoreeName} footerVariant="minimal" hideChatWidget homeHref={`/events/${event.slug}`}>
      <div className="bg-ivory-50 pb-24 pt-28 sm:pt-32">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <Reveal>
            <p className="text-xs uppercase tracking-[0.35em] text-gold-500">Add to the Timeline</p>
            <h1 className="mt-4 font-display text-3xl text-navy-950 sm:text-4xl">{event.honoreeName}&rsquo;s story</h1>
            <div className="divider-gold mx-auto mt-6 w-20" />
            <p className="mt-6 text-sm tracking-wide text-navy-700/70">
              Have photos from a moment in {event.honoreeName}&rsquo;s life? Share them here
              {event.hostedBy ? ` — ${event.hostedBy} will add them to the timeline` : ""}.
            </p>
          </Reveal>
        </div>

        <div className="mx-auto mt-10 max-w-2xl px-4 sm:px-6">
          {enabled ? (
            <Reveal delay={0.1}>
              <TimelineShareForm
                eventSlug={event.slug}
                honoreeName={event.honoreeName}
                milestones={milestones}
                inviteToken={ownGuest ? (t ?? null) : null}
                guestName={ownGuest?.name ?? null}
              />
            </Reveal>
          ) : (
            <Reveal delay={0.1}>
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-gold-500/15 bg-white px-8 py-12 text-center shadow-sm">
                <HeartHandshake className="text-gold-500" size={32} />
                <h2 className="font-display text-xl text-navy-950">This page isn&rsquo;t open right now</h2>
                <p className="max-w-sm text-sm text-navy-700/75">
                  {event.hostedBy || "The host"} hasn&rsquo;t opened the timeline for contributions yet.
                </p>
              </div>
            </Reveal>
          )}
        </div>
      </div>
    </SiteShell>
  );
}

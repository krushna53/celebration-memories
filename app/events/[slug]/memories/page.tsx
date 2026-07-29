import { cache } from "react";
import { HeartHandshake } from "lucide-react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getEventBySlug } from "@/services/events";
import { buildEventMetadata } from "@/lib/event-metadata";
import { PublicMemoryUploader } from "@/features/uploads/public-memory-uploader";
import { PageViewBeacon } from "@/features/analytics/page-view-beacon";
import { Reveal } from "@/components/motion/reveal";
import { SiteShell } from "@/components/layout/site-shell";

export const dynamic = "force-dynamic";

interface PublicMemoriesPageProps {
  params: Promise<{ slug: string }>;
}

const loadEvent = cache((slug: string) => getEventBySlug(slug));

export async function generateMetadata({ params }: PublicMemoriesPageProps): Promise<Metadata> {
  const { slug } = await params;
  const event = await loadEvent(slug);
  const base = await buildEventMetadata(event);
  return {
    ...base,
    title: event ? `Share a Memory — ${event.honoreeName}` : "Share a Memory",
  };
}

/**
 * Public, no-invite-link "share a memory" page — the direct link a host
 * hands out to relatives so they can upload a video/photo/audio memory
 * without needing a personal /invite/[token] link each. Only reachable
 * when an admin has flipped "Allow public memory uploads" on in Event
 * Settings (events.public_memories_enabled); otherwise shows guidance
 * instead of a dead end, same pattern as /events/[slug]/rsvp.
 *
 * Visitors identify themselves by name only (see
 * features/uploads/public-memory-uploader.tsx), then reuse the exact
 * same upload components as a personal invite link — uploads still need
 * admin approval before appearing on the public Memory Wall.
 */
export default async function PublicMemoriesPage({ params }: PublicMemoriesPageProps) {
  const { slug } = await params;
  const event = await loadEvent(slug);

  if (!event) {
    notFound();
  }

  return (
    <SiteShell honoreeName={event.honoreeName} footerVariant="minimal">
      <PageViewBeacon eventId={event.id} page="public_memories" />
      <div className="bg-ivory-50 pb-24 pt-28 sm:pt-32">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <Reveal>
            <p className="text-xs uppercase tracking-[0.35em] text-gold-500">Share a memory of</p>
            <h1 className="mt-4 font-display text-3xl text-navy-950 sm:text-4xl">
              {event.honoreeName}
            </h1>
            <div className="divider-gold mx-auto mt-6 w-20" />
            <p className="mt-6 text-sm tracking-wide text-navy-700/70">
              A photo, a video, or a short audio message — {event.hostedBy} would
              love to have it.
            </p>
          </Reveal>
        </div>

        <div className="mx-auto mt-12 max-w-xl px-4 sm:px-6">
          {event.publicMemoriesEnabled ? (
            <Reveal delay={0.1}>
              <PublicMemoryUploader eventSlug={slug} honoreeName={event.honoreeName} />
            </Reveal>
          ) : (
            <Reveal delay={0.1}>
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-gold-500/15 bg-white px-8 py-12 text-center shadow-sm">
                <HeartHandshake className="text-gold-500" size={32} />
                <h3 className="font-display text-xl text-navy-950">
                  This link isn&rsquo;t open right now
                </h3>
                <p className="max-w-sm text-sm text-navy-700/75">
                  If you have a personal invitation link from {event.hostedBy}, you
                  can upload memories from there instead.
                </p>
              </div>
            </Reveal>
          )}
        </div>
      </div>
    </SiteShell>
  );
}

import { cache } from "react";
import { HeartHandshake, Images } from "lucide-react";
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
    <SiteShell honoreeName={event.honoreeName} footerVariant="minimal" hideChatWidget homeHref={`/events/${event.slug}`}>
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

      {/*
        Floating shortcut to the public Memory Wall (#memories on the
        event's own homepage) — a guest landing straight on this upload
        page via a shared link has no other way to browse what everyone
        else has already shared. Fixed position, high-contrast gold pill
        with a subtle pulse ring so it reads as tappable at a glance
        rather than blending into the page.
      */}
      <a
        href={`/events/${event.slug}#memories`}
        target="_blank"
        rel="noopener noreferrer"
        className="tap-target fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-gold-500 px-4 py-3 text-sm font-medium text-navy-950 shadow-lg shadow-navy-950/20 transition-luxury duration-300 hover:brightness-110 sm:bottom-8 sm:right-8 sm:px-5"
      >
        <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-gold-500/50" />
        <Images size={18} />
        <span>See memories shared by others</span>
      </a>
    </SiteShell>
  );
}

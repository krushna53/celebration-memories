import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { SITE_URL } from "@/lib/constants";
import { buildEventMetadata } from "@/lib/event-metadata";
import { getPublicEventById as getEventById } from "@/services/events";
import { getGuestReelByShareToken } from "@/services/guest-reels";
import { ReelSharePanel } from "@/features/reels/reel-share-panel";
import { SiteShell } from "@/components/layout/site-shell";

export const dynamic = "force-dynamic";

interface ReelPageProps {
  params: Promise<{ shareToken: string }>;
}

const load = cache(async (shareToken: string) => {
  const reel = await getGuestReelByShareToken(shareToken);
  if (!reel?.videoUrl) return null;
  const event = await getEventById(reel.eventId);
  return event ? { reel, event } : null;
});

/**
 * Public page for one guest's finished reel — what "Send link on
 * WhatsApp" / "Copy link" share. The long random share token is the only
 * way in (same bearer-token model as invite links), and the page is
 * never indexed.
 */
export async function generateMetadata({ params }: ReelPageProps): Promise<Metadata> {
  const { shareToken } = await params;
  const found = await load(shareToken);
  if (!found) return { title: "Reel not found", robots: { index: false, follow: false } };
  const base = await buildEventMetadata(found.event);
  const title = `${found.reel.guestName} celebrating ${found.event.honoreeName}`;
  const video = new URL(found.reel.videoUrl!, SITE_URL).toString();
  return {
    ...base,
    title,
    robots: { index: false, follow: false },
    openGraph: { ...base.openGraph, title, type: "video.other", videos: [{ url: video, type: "video/mp4", width: 1080, height: 1920 }] },
  };
}

export default async function ReelPage({ params }: ReelPageProps) {
  const { shareToken } = await params;
  const found = await load(shareToken);
  if (!found) notFound();
  const { reel, event } = found;
  const first = reel.guestName.trim().split(/\s+/)[0] ?? reel.guestName;

  return (
    <SiteShell honoreeName={event.honoreeName} footerVariant="minimal" homeHref={`/events/${event.slug}`}>
      <div className="bg-ivory-50 pb-24 pt-28 sm:pt-32">
        <div className="mx-auto max-w-xl px-4 text-center sm:px-6">
          <p className="text-xs uppercase tracking-[0.35em] text-gold-500">{event.occasion || event.eventTitle}</p>
          <h1 className="mt-4 font-display text-3xl text-navy-950 sm:text-4xl">
            {first} &amp; {event.honoreeName}
          </h1>
          <div className="divider-gold mx-auto mt-6 w-20" />
          <div className="mt-8">
            <ReelSharePanel
              videoUrl={reel.videoUrl!}
              shareUrl={`${SITE_URL}/reels/${reel.shareToken}`}
              shareText={`Celebrating ${event.honoreeName} 🎉`}
              fileName={`${first.toLowerCase()}-reel`}
            />
          </div>
          <Link
            href={`/events/${event.slug}`}
            className="mt-10 inline-block text-sm text-gold-600 underline underline-offset-4"
          >
            See the celebration page
          </Link>
        </div>
      </div>
    </SiteShell>
  );
}

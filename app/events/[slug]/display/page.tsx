import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getEventBySlug } from "@/services/events";
import { listGalleryPhotos } from "@/services/gallery-photos";
import { listMilestones } from "@/services/timeline";
import { getMemoryWallItems } from "@/services/memory-wall";
import { buildDisplaySlides } from "@/lib/build-display-slides";
import { BigScreenSlideshow } from "@/features/display/big-screen-slideshow";

// Always dynamic: this is meant to be left open on a TV/projector for
// hours, so it should always reflect the latest approved memories, not
// a cached snapshot from whenever it was first opened.
export const dynamic = "force-dynamic";

interface BigScreenDisplayPageProps {
  params: Promise<{ slug: string }>;
}

const loadEvent = cache((slug: string) => getEventBySlug(slug));

export async function generateMetadata({ params }: BigScreenDisplayPageProps): Promise<Metadata> {
  const { slug } = await params;
  const event = await loadEvent(slug);
  return {
    title: event ? `${event.honoreeName} — Big Screen Display` : "Big Screen Display",
    // Never worth indexing — this is a kiosk view, not a page people land on from search.
    robots: { index: false, follow: false },
  };
}

/**
 * "Big Screen Display" — a chrome-free, full-viewport slideshow meant to
 * be opened on a TV or projector at the venue: Gallery photos, then the
 * Timeline, then memories shared by relatives (photos/videos/audio/
 * notes), looping forever. No SiteShell here on purpose — no header, no
 * nav, no footer, just the slides themselves (see
 * features/display/big-screen-slideshow.tsx).
 *
 * Public and unauthenticated, same trust model as the homepage/Memory
 * Wall: everything shown here (Gallery, Timeline, approved memories) is
 * already publicly visible on the event's normal page — this view just
 * re-presents it full-screen for a shared display instead of a phone.
 */
export default async function BigScreenDisplayPage({ params }: BigScreenDisplayPageProps) {
  const { slug } = await params;
  const event = await loadEvent(slug);

  if (!event) {
    notFound();
  }

  const [galleryPhotos, milestones, memories] = await Promise.all([
    listGalleryPhotos(event.id).catch(() => []),
    listMilestones(event.id).catch(() => []),
    getMemoryWallItems(event.id, 100).catch(() => []),
  ]);

  const slides = buildDisplaySlides({ event, galleryPhotos, milestones, memories });

  return <BigScreenSlideshow slides={slides} />;
}

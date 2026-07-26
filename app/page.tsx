import { HeroSection } from "@/features/hero/hero-section";
import { CountdownSection } from "@/features/countdown/countdown-section";
import { InvitationSection } from "@/features/invitation/invitation-section";
import { EventDetailsSection } from "@/features/event-details/event-details-section";
import { GallerySection } from "@/features/gallery/gallery-section";
import { TimelineSection } from "@/features/timeline/timeline-section";
import { RsvpTeaserSection } from "@/features/rsvp/rsvp-teaser-section";
import { MemoryWallSection } from "@/features/memory-wall/memory-wall-section";
import { SiteShell } from "@/components/layout/site-shell";
import { EVENT_SLUG } from "@/lib/constants";
import { getEventBySlug } from "@/services/events";
import { listGalleryPhotos } from "@/services/gallery-photos";
import { listMilestones } from "@/services/timeline";
import { toEventDisplayData } from "@/lib/event-display";
import type { EventRecord } from "@/types/event";
import type { GalleryPhotoRecord } from "@/types/content";
import type { TimelineMilestoneRecord } from "@/types/content";

/**
 * Homepage. Section order follows CLAUDE.md → Homepage spec: Hero,
 * Countdown, Invitation, Event Details (incl. Location/maps), Gallery,
 * Timeline, RSVP, Guest Memories.
 *
 * All event/gallery/timeline content is admin-editable (see /admin) and
 * fetched here server-side. Falls back to lib/constants.ts defaults and
 * empty content lists if Supabase is unreachable, so the homepage never
 * hard-fails — see toEventDisplayData().
 *
 * Revalidated periodically (not fully static) so edits made in the
 * admin dashboard show up without a full redeploy.
 */
export const revalidate = 60;

export default async function Home() {
  let event: EventRecord | null = null;
  let galleryPhotos: GalleryPhotoRecord[] = [];
  let milestones: TimelineMilestoneRecord[] = [];

  try {
    event = await getEventBySlug(EVENT_SLUG);
    if (event) {
      [galleryPhotos, milestones] = await Promise.all([
        listGalleryPhotos(event.id),
        listMilestones(event.id),
      ]);
    }
  } catch (err) {
    console.error("Homepage failed to load event data:", err);
  }

  const data = toEventDisplayData(event);

  return (
    <SiteShell honoreeName={data.honoreeName}>
      <HeroSection data={data} />
      <CountdownSection isoStart={data.isoStart} />
      <InvitationSection data={data} />
      <EventDetailsSection data={data} />
      <GallerySection photos={galleryPhotos} />
      <TimelineSection milestones={milestones} />
      <RsvpTeaserSection />
      <MemoryWallSection />
    </SiteShell>
  );
}

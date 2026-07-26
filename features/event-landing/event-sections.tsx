import { HeroSection } from "@/features/hero/hero-section";
import { CountdownSection } from "@/features/countdown/countdown-section";
import { InvitationSection } from "@/features/invitation/invitation-section";
import { EventDetailsSection } from "@/features/event-details/event-details-section";
import { GallerySection } from "@/features/gallery/gallery-section";
import { TimelineSection } from "@/features/timeline/timeline-section";
import { RsvpTeaserSection } from "@/features/rsvp/rsvp-teaser-section";
import { MemoryWallSection } from "@/features/memory-wall/memory-wall-section";
import type { EventDisplayData } from "@/lib/event-display";
import type { EventRecord } from "@/types/event";
import type { GalleryPhotoRecord, TimelineMilestoneRecord } from "@/types/content";

export interface EventSectionsProps {
  event: EventRecord | null;
  displayData: EventDisplayData;
  galleryPhotos: GalleryPhotoRecord[];
  milestones: TimelineMilestoneRecord[];
}

/**
 * The Hero-through-Memory-Wall section stack, in CLAUDE.md's homepage
 * order. This is the one place that composes those sections — every
 * template (see /lib/templates.ts) renders this same component inside
 * its own themed shell, so templates only ever differ by colour/font/
 * layout wrapper, never by section logic or data-fetching.
 */
export function EventSections({ event, displayData: data, galleryPhotos, milestones }: EventSectionsProps) {
  return (
    <>
      <HeroSection data={data} />
      <CountdownSection isoStart={data.isoStart} />
      <InvitationSection data={data} />
      <EventDetailsSection data={data} />
      <GallerySection photos={galleryPhotos} />
      <TimelineSection milestones={milestones} />
      <RsvpTeaserSection />
      {event ? <MemoryWallSection eventId={event.id} /> : null}
    </>
  );
}

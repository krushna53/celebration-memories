import { HeroSection } from "@/features/hero/hero-section";
import { CountdownSection } from "@/features/countdown/countdown-section";
import { InvitationSection } from "@/features/invitation/invitation-section";
import { EventDetailsSection } from "@/features/event-details/event-details-section";
import { GallerySection } from "@/features/gallery/gallery-section";
import { TimelineSection } from "@/features/timeline/timeline-section";
import { RsvpTeaserSection } from "@/features/rsvp/rsvp-teaser-section";
import { MemoryWallSection } from "@/features/memory-wall/memory-wall-section";

/**
 * Homepage. Section order follows CLAUDE.md → Homepage spec: Hero,
 * Countdown, Invitation, Event Details (incl. Location/maps), Gallery,
 * Timeline, RSVP, Guest Memories.
 *
 * Revalidated periodically (not fully static) so newly-approved Memory
 * Wall entries show up without a full redeploy.
 */
export const revalidate = 60;

export default function Home() {
  return (
    <>
      <HeroSection />
      <CountdownSection />
      <InvitationSection />
      <EventDetailsSection />
      <GallerySection />
      <TimelineSection />
      <RsvpTeaserSection />
      <MemoryWallSection />
    </>
  );
}

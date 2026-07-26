import { HeroSection } from "@/features/hero/hero-section";
import { CountdownSection } from "@/features/countdown/countdown-section";
import { InvitationSection } from "@/features/invitation/invitation-section";
import { EventDetailsSection } from "@/features/event-details/event-details-section";
import { GallerySection } from "@/features/gallery/gallery-section";
import { TimelineSection } from "@/features/timeline/timeline-section";
import { RsvpTeaserSection } from "@/features/rsvp/rsvp-teaser-section";

/**
 * Homepage. Section order follows CLAUDE.md → Homepage spec:
 * Hero, Countdown, Invitation, Event Details, Gallery, Timeline, RSVP.
 * Guest Memories (Memory Wall) ships in Phase 4.
 */
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
    </>
  );
}

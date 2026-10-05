import { Fragment, type ReactNode } from "react";

import { HeroSection } from "@/features/hero/hero-section";
import { CountdownSection } from "@/features/countdown/countdown-section";
import { InvitationSection } from "@/features/invitation/invitation-section";
import { EventDetailsSection } from "@/features/event-details/event-details-section";
import { LiveStreamSection } from "@/features/live-stream/live-stream-section";
import { GallerySection } from "@/features/gallery/gallery-section";
import { GallerySectionServer } from "@/features/gallery/gallery-section-server";
import { TimelineSection } from "@/features/timeline/timeline-section";
import { EventDayHomepageSection } from "@/features/event-day/event-day-homepage-section";
import { RsvpTeaserSection } from "@/features/rsvp/rsvp-teaser-section";
import { WishMessageSection } from "@/features/event-landing/wish-message-section";
import { MemoryWallSection } from "@/features/memory-wall/memory-wall-section";
import { PageViewBeacon } from "@/features/analytics/page-view-beacon";
import { normalizeSectionConfig, type SectionKey } from "@/lib/section-registry";
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
 * The Hero-through-Memory-Wall section stack. Hero always renders
 * first (see lib/section-registry.ts for why); everything after it
 * renders in whichever order/visibility the admin set on
 * /admin/event-settings (events.section_config) — defaulting to
 * CLAUDE.md's original order when unset, so existing events are
 * unaffected until an admin actively customizes theirs.
 *
 * Every template (see /lib/templates.ts) renders this same component
 * inside its own themed shell, so templates only ever differ by
 * colour/font/layout wrapper, never by section logic or data-fetching
 * — and the section builder works identically across all of them.
 */
/** After the event: memories first; the invitation-era sections no longer apply. */
const RELIVE_ORDER: SectionKey[] = ["memoryWall", "gallery", "timeline", "wishMessage"];

export function EventSections({ event, displayData: data, galleryPhotos, milestones }: EventSectionsProps) {
  // "Relive the day" mode switches on by itself once the event has ended (endAt is an absolute
  // instant, so no timezone maths needed); the page revalidates every minute.
  const ended = Boolean(event?.endAt && Date.parse(event.endAt) < Date.now());
  const baseConfig = normalizeSectionConfig(event?.sectionConfig);
  const config = ended
    ? RELIVE_ORDER.flatMap((key) => baseConfig.filter((item) => item.key === key))
    : baseConfig;
  const relive =
    ended && event
      ? { shareHref: event.publicMemoriesEnabled ? `/events/${event.slug}/memories` : "#memories" }
      : null;

  const sectionsByKey: Record<SectionKey, ReactNode> = {
    countdown: <CountdownSection isoStart={data.isoStart} />,
    invitation: <InvitationSection data={data} />,
    eventDetails: <EventDetailsSection data={data} />,
    liveStream: <LiveStreamSection enabled={event?.liveStreamEnabled ?? false} url={event?.liveStreamUrl ?? null} />,
    gallery: event ? <GallerySectionServer eventId={event.id} eventSlug={event.slug} photos={galleryPhotos} /> : <GallerySection photos={galleryPhotos} />,
    timeline: <TimelineSection milestones={milestones} />,
    rsvp: (
      <RsvpTeaserSection
        eventId={event?.id}
        eventSlug={event?.slug}
        publicRsvpEnabled={event?.publicRsvpEnabled}
        honoreeName={event?.honoreeName}
      />
    ),
    wishMessage: <WishMessageSection data={data} />,
    memoryWall: event ? (
      <MemoryWallSection
        eventId={event.id}
        eventSlug={event.slug}
        publicMemoriesEnabled={event.publicMemoriesEnabled}
      />
    ) : null,
  };

  return (
    <>
      {event ? <PageViewBeacon eventId={event.id} page="landing" /> : null}
      <HeroSection data={data} relive={relive} />
      {config
        .filter((item) => item.visible)
        .map((item) => (
          <Fragment key={item.key}>{sectionsByKey[item.key]}</Fragment>
        ))}
      {/*
        Event Day (schedule + menu) deliberately sits outside the
        reorderable section registry — it's opt-in per event via
        events.event_day_mode (admin-managed at /admin/event-day) rather
        than an always-present toggle, and only ever shows here when
        that mode is "public" (see types/event.ts's doc comment). When
        "private", it's reachable only via the phone-verified
        /event-day/[token] link, never on this page.
      */}
      {event && event.eventDayMode === "public" && !ended ? (
        <EventDayHomepageSection eventId={event.id} menuStyle={event.menuStyle} />
      ) : null}
    </>
  );
}

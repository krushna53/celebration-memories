import { SiteShell } from "@/components/layout/site-shell";
import { EventSections } from "@/features/event-landing/event-sections";
import { TemplateThemeWrapper } from "@/templates/shared/template-theme-wrapper";
import { BestsellerHero } from "@/templates/Bestseller/bestseller-hero";
import type { SectionKey } from "@/lib/section-registry";
import { bestsellerTheme } from "./theme";
import type { BirthdayTemplateProps } from "@/lib/templates";

import "./bestseller.css";

/**
 * Biography events: the page is the book. A hardback-cover hero with
 * "Read the Book" (the AI-written biography, /events/<slug>/book), then the
 * life timeline the AI drew from the story, the gallery and the family's
 * memories. Sections about attending an event (countdown, RSVP, venue…)
 * never show — a biography has no date to attend.
 */
const NOT_FOR_A_BIOGRAPHY: readonly SectionKey[] = ["datePoll", "countdown", "invitation", "eventDetails", "payment", "liveStream", "rsvp"];

export default function Bestseller(props: BirthdayTemplateProps) {
  return (
    <TemplateThemeWrapper theme={bestsellerTheme} overrides={props.event?.themeOverrides}>
      <SiteShell honoreeName={props.displayData.honoreeName} transparentUntilScroll>
        <EventSections
          event={props.event}
          displayData={props.displayData}
          galleryPhotos={props.galleryPhotos}
          milestones={props.milestones}
          omitSections={NOT_FOR_A_BIOGRAPHY}
          renderHero={() => (props.event ? <BestsellerHero event={props.event} hasTimeline={props.milestones.length > 0} /> : null)}
        />
      </SiteShell>
    </TemplateThemeWrapper>
  );
}

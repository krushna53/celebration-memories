import { SiteShell } from "@/components/layout/site-shell";
import { EventSections } from "@/features/event-landing/event-sections";
import { TemplateThemeWrapper } from "@/templates/shared/template-theme-wrapper";
import { minimalWhiteTheme } from "@/templates/MinimalWhite/theme";
import { buildCardTemplateTheme } from "@/lib/card-theme";
import { getEventCardTheme } from "@/services/event-extras";
import type { BirthdayTemplateProps } from "@/lib/templates";

/**
 * "Matched to your card" — built from the colours and type style read off
 * this event's invitation card (events.card_theme, lib/card-theme.ts).
 * Falls back to Minimal White when the event has no card theme, so it
 * never renders broken.
 */
export default async function CardMatch(props: BirthdayTemplateProps) {
  const card = props.event ? await getEventCardTheme(props.event.id) : null;
  const theme = card ? buildCardTemplateTheme(card) : minimalWhiteTheme;
  return (
    <TemplateThemeWrapper theme={theme} overrides={props.event?.themeOverrides}>
      <SiteShell honoreeName={props.displayData.honoreeName} transparentUntilScroll>
        <EventSections
          event={props.event}
          displayData={props.displayData}
          galleryPhotos={props.galleryPhotos}
          milestones={props.milestones}
        />
      </SiteShell>
    </TemplateThemeWrapper>
  );
}

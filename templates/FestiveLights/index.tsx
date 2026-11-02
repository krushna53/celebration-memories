import { SiteShell } from "@/components/layout/site-shell";
import { EventSections } from "@/features/event-landing/event-sections";
import { TemplateThemeWrapper } from "@/templates/shared/template-theme-wrapper";
import { RespectReducedMotion } from "@/templates/WhiteCoatReunion/reduced-motion";
import { FestiveLightsHero } from "@/templates/FestiveLights/festive-lights-hero";
import { normalizeSectionConfig } from "@/lib/section-registry";
import { festiveLightsTheme } from "./theme";
import type { BirthdayTemplateProps } from "@/lib/templates";

import "./festive-lights.css";

/**
 * Diwali and other festivals of light. Same section stack as every
 * template, with its own hero: a night sky of rising lanterns, sparkles and
 * soft fireworks over a row of flickering diyas, all pure CSS and switched
 * off for prefers-reduced-motion.
 *
 * When the host hides Event Details, the hero leaves out the date too —
 * that's the "just a title and an RSVP" page, e.g. a gathering over two
 * days where guests pick their session in the RSVP form.
 */
export default function FestiveLights(props: BirthdayTemplateProps) {
  const showDetails = normalizeSectionConfig(props.event?.sectionConfig).some(
    (item) => item.key === "eventDetails" && item.visible,
  );

  return (
    <TemplateThemeWrapper theme={festiveLightsTheme} overrides={props.event?.themeOverrides}>
      <RespectReducedMotion>
        <div className="fl">
          <SiteShell honoreeName={props.displayData.honoreeName} transparentUntilScroll>
            <EventSections
              event={props.event}
              displayData={props.displayData}
              galleryPhotos={props.galleryPhotos}
              milestones={props.milestones}
              renderHero={(relive) => <FestiveLightsHero data={props.displayData} relive={relive} showDetails={showDetails} />}
            />
          </SiteShell>
        </div>
      </RespectReducedMotion>
    </TemplateThemeWrapper>
  );
}

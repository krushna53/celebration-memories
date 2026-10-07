import { SiteShell } from "@/components/layout/site-shell";
import { EventSections } from "@/features/event-landing/event-sections";
import { TemplateThemeWrapper } from "@/templates/shared/template-theme-wrapper";
import { ReunionHero } from "@/templates/WhiteCoatReunion/reunion-hero";
import { RespectReducedMotion } from "@/templates/WhiteCoatReunion/reduced-motion";
import { whiteCoatReunionTheme } from "./theme";
import type { BirthdayTemplateProps } from "@/lib/templates";

import "./white-coat-reunion.css";

/**
 * Doctors' / alumni batch reunions. Same section stack as every template,
 * with its own hero (which carries the page's only countdown, so the
 * standalone Countdown section is omitted) and a scoped stylesheet for a
 * larger, senior-friendly type scale, tighter section rhythm, a gold
 * pulse-line divider and an editorial frame for the reunion note.
 */
export default function WhiteCoatReunion(props: BirthdayTemplateProps) {
  return (
    <TemplateThemeWrapper
      theme={whiteCoatReunionTheme}
      overrides={props.event?.themeOverrides}
    >
      <RespectReducedMotion>
        <div className="wcr">
          <SiteShell
            honoreeName={props.displayData.honoreeName}
            transparentUntilScroll
          >
            <EventSections
              event={props.event}
              displayData={props.displayData}
              galleryPhotos={props.galleryPhotos}
              milestones={props.milestones}
              omitSections={["countdown"]}
              renderHero={(relive) => (
                <ReunionHero
                  data={props.displayData}
                  galleryPhotos={props.galleryPhotos}
                  relive={relive}
                />
              )}
            />
          </SiteShell>
        </div>
      </RespectReducedMotion>
    </TemplateThemeWrapper>
  );
}

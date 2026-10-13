import { SiteShell } from "@/components/layout/site-shell";
import { EventSections } from "@/features/event-landing/event-sections";
import { TemplateThemeWrapper } from "@/templates/shared/template-theme-wrapper";
import { humanOsTheme } from "./theme";
import type { BirthdayTemplateProps } from "@/lib/templates";

/**
 * The card is flat cream with no photo or sparkle, so this template hides
 * the shared hero's faded background photo and floating particles —
 * scoped to this wrapper only, every other template is untouched.
 */
const HERO_STYLE = `
.tpl-humanos #hero > .absolute.inset-0 > img { display: none; }
.tpl-humanos #hero > [aria-hidden="true"].pointer-events-none.absolute.inset-0 { display: none; }
`;

/** Private client template (see TEMPLATE_CATALOG's `access`) — same section stack as every template, HumanOS palette. */
export default function HumanOs(props: BirthdayTemplateProps) {
  return (
    <TemplateThemeWrapper theme={humanOsTheme} overrides={props.event?.themeOverrides}>
      <div className="tpl-humanos">
        <style>{HERO_STYLE}</style>
        <SiteShell honoreeName={props.displayData.honoreeName} transparentUntilScroll>
          <EventSections
            event={props.event}
            displayData={props.displayData}
            galleryPhotos={props.galleryPhotos}
            milestones={props.milestones}
          />
        </SiteShell>
      </div>
    </TemplateThemeWrapper>
  );
}

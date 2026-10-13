import { SiteShell } from "@/components/layout/site-shell";
import { EventSections } from "@/features/event-landing/event-sections";
import { TemplateThemeWrapper } from "@/templates/shared/template-theme-wrapper";
import { humanOsTheme } from "./theme";
import type { BirthdayTemplateProps } from "@/lib/templates";

/** Private client template (see TEMPLATE_CATALOG's `access`) — same section stack as every template, HumanOS palette. */
export default function HumanOs(props: BirthdayTemplateProps) {
  return (
    <TemplateThemeWrapper theme={humanOsTheme} overrides={props.event?.themeOverrides}>
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

import { SiteShell } from "@/components/layout/site-shell";
import { EventSections } from "@/features/event-landing/event-sections";
import { TemplateThemeWrapper } from "@/templates/shared/template-theme-wrapper";
import { goldenConfettiTheme } from "./theme";
import type { BirthdayTemplateProps } from "@/lib/templates";

export default function GoldenConfetti(props: BirthdayTemplateProps) {
  return (
    <TemplateThemeWrapper theme={goldenConfettiTheme}>
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

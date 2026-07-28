import { SiteShell } from "@/components/layout/site-shell";
import { EventSections } from "@/features/event-landing/event-sections";
import { TemplateThemeWrapper } from "@/templates/shared/template-theme-wrapper";
import { brightBeginningsTheme } from "./theme";
import type { BirthdayTemplateProps } from "@/lib/templates";

export default function BrightBeginnings(props: BirthdayTemplateProps) {
  return (
    <TemplateThemeWrapper theme={brightBeginningsTheme}>
      <SiteShell honoreeName={props.displayData.honoreeName}>
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

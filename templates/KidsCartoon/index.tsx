import { SiteShell } from "@/components/layout/site-shell";
import { EventSections } from "@/features/event-landing/event-sections";
import { TemplateThemeWrapper } from "@/templates/shared/template-theme-wrapper";
import { BirthdayDecor } from "@/templates/shared/birthday-decor";
import { kidsCartoonTheme } from "./theme";
import type { BirthdayTemplateProps } from "@/lib/templates";

export default function KidsCartoon(props: BirthdayTemplateProps) {
  return (
    <TemplateThemeWrapper
      theme={kidsCartoonTheme}
      overrides={props.event?.themeOverrides}
    >
      <div className="relative">
        {/* Bunting, rising balloons (tap to pop) and an opening confetti shower — see birthday-decor.tsx. */}
        <BirthdayDecor
          variant="kids"
          bannerText={
            !props.event || props.event.category === "birthday"
              ? "HAPPY BIRTHDAY"
              : null
          }
        />
        <SiteShell
          honoreeName={props.displayData.honoreeName}
          transparentUntilScroll
        >
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

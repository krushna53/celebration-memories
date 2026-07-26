import { listGalleryPhotos } from "@/services/gallery-photos";
import { listMilestones } from "@/services/timeline";
import { toEventDisplayData } from "@/lib/event-display";
import { resolveTemplate } from "@/lib/templates";
import { CustomCssBlock } from "@/features/event-landing/custom-css-block";
import type { EventRecord } from "@/types/event";
import type { GalleryPhotoRecord, TimelineMilestoneRecord } from "@/types/content";

interface EventLandingPageProps {
  event: EventRecord | null;
}

/**
 * The full public "mini-site" for one event: Hero through Memory Wall,
 * rendered through whichever template the event has selected (see
 * /lib/templates.ts — falls back to the default "Royal Gold" look when
 * there's no event row, matching the platform's original design).
 *
 * Shared by the primary homepage (/, always EVENT_SLUG) and the generic
 * /events/[slug] route, so every event gets the identical experience
 * regardless of which URL it's reached through.
 */
export async function EventLandingPage({ event }: EventLandingPageProps) {
  let galleryPhotos: GalleryPhotoRecord[] = [];
  let milestones: TimelineMilestoneRecord[] = [];

  if (event) {
    try {
      [galleryPhotos, milestones] = await Promise.all([
        listGalleryPhotos(event.id),
        listMilestones(event.id),
      ]);
    } catch (err) {
      console.error("EventLandingPage failed to load gallery/timeline:", err);
    }
  }

  const template = await resolveTemplate(event?.templateSlug);
  const TemplateComponent = template.component;
  const displayData = toEventDisplayData(event);

  return (
    <>
      <CustomCssBlock css={event?.customCss ?? null} />
      <TemplateComponent
        event={event}
        displayData={displayData}
        galleryPhotos={galleryPhotos}
        milestones={milestones}
      />
    </>
  );
}

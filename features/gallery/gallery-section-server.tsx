import { GallerySection } from "@/features/gallery/gallery-section";
import { listGalleryPairs, listGuestGalleryPhotos } from "@/services/gallery-story";
import type { GalleryPhotoRecord } from "@/types/content";

/**
 * Loads the gallery's storytelling extras — "Then & Now" pairs and
 * approved guest photos — alongside the family photos the event page
 * already fetched, so templates don't each need to thread new props.
 * Either extra failing just hides that part of the gallery.
 */
export async function GallerySectionServer({
  eventId,
  eventSlug,
  photos,
  chapterTitles = null,
}: {
  eventId: string;
  eventSlug: string;
  photos: GalleryPhotoRecord[];
  chapterTitles?: Record<string, string> | null;
}) {
  const [pairs, guestPhotos] = await Promise.all([
    listGalleryPairs(eventId).catch(() => []),
    listGuestGalleryPhotos(eventId).catch(() => []),
  ]);
  return (
    <GallerySection
      photos={photos}
      pairs={pairs}
      guestPhotos={guestPhotos}
      fullGalleryHref={`/events/${encodeURIComponent(eventSlug)}/gallery`}
      eventId={eventId}
      chapterTitles={chapterTitles}
    />
  );
}

import type { EventRecord } from "@/types/event";
import type { GalleryPhotoRecord, TimelineMilestoneRecord } from "@/types/content";
import type { MemoryItem } from "@/types/memory";
import type { DisplaySlide } from "@/types/display";

/**
 * Pure data-shaping function (no I/O) — merges an event's Gallery,
 * Timeline, and approved Memory Wall items into one ordered slide deck
 * for the Big Screen Display (app/events/[slug]/display). Order matches
 * what was asked for: a title card, then the client's Gallery, then the
 * Timeline, then memories shared by relatives (newest first, since
 * `memories` already arrives sorted that way from getMemoryWallItems).
 *
 * Deliberately skips guestbook entries with no message (shouldn't exist
 * given the form requires one, but keeps this function total either way).
 */
export function buildDisplaySlides(params: {
  event: EventRecord;
  galleryPhotos: GalleryPhotoRecord[];
  milestones: TimelineMilestoneRecord[];
  memories: MemoryItem[];
  /** Resolved public URL for events.highlight_reel_path, if set — resolving storage paths to URLs is the caller's job (see app/events/[slug]/display/page.tsx) so this function stays pure/no-I/O. */
  highlightReelUrl?: string | null;
}): DisplaySlide[] {
  const { event, galleryPhotos, milestones, memories, highlightReelUrl } = params;

  const slides: DisplaySlide[] = [
    {
      id: "title",
      kind: "title",
      honoreeName: event.honoreeName,
      eventTitle: event.eventTitle,
      hostedBy: event.hostedBy,
      occasionDate: event.occasionDate,
    },
  ];

  if (highlightReelUrl) {
    slides.push({ id: "highlight-reel", kind: "highlight-reel", url: highlightReelUrl });
  }

  for (const photo of galleryPhotos) {
    slides.push({
      id: `gallery-${photo.id}`,
      kind: "gallery-photo",
      url: photo.url,
      caption: photo.caption,
    });
  }

  for (const milestone of milestones) {
    slides.push({
      id: `timeline-${milestone.id}`,
      kind: "timeline",
      imageUrl: milestone.imageUrl,
      period: milestone.period,
      title: milestone.title,
      description: milestone.description,
    });
  }

  for (const memory of memories) {
    const authorName = memory.author.name;
    if (memory.kind === "photo") {
      slides.push({
        id: `memory-${memory.id}`,
        kind: "memory-photo",
        url: memory.url,
        authorName,
        caption: memory.caption,
      });
    } else if (memory.kind === "video") {
      slides.push({ id: `memory-${memory.id}`, kind: "memory-video", url: memory.url, authorName });
    } else if (memory.kind === "audio") {
      slides.push({ id: `memory-${memory.id}`, kind: "memory-audio", url: memory.url, authorName });
    } else if (memory.kind === "guestbook" && memory.message) {
      slides.push({
        id: `memory-${memory.id}`,
        kind: "memory-note",
        message: memory.message,
        authorName,
        country: memory.country,
        thumbnailUrl: memory.thumbnailUrl,
      });
    }
  }

  return slides;
}

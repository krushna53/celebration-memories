import "server-only";

import { listGalleryPhotos } from "@/services/gallery-photos";
import { listMemoriesForModeration } from "@/services/admin-memories";
import { listCompletedAiImageJobs } from "@/services/ai-image-jobs";
import { listCompletedSlideshowVideoJobs } from "@/services/slideshow-video-jobs";
import { listVideoEditJobs } from "@/services/video-editor";
import { listCompletedTimelineMovieJobs } from "@/services/timeline-movie-jobs";
import type { MediaLibraryItem } from "@/lib/media-library-kinds";

// Re-exported for backward compatibility with existing imports of these
// from this module — the actual definitions live in
// lib/media-library-kinds.ts now (a client-safe module with no
// "server-only" guard), since MEDIA_LIBRARY_KIND_LABEL etc. are real
// runtime constants, not just types, and a client component importing
// a runtime value from a "server-only" module fails the build. See
// that file's header comment for the full story.
export type { MediaLibraryKind, MediaLibraryItem } from "@/lib/media-library-kinds";
export {
  MEDIA_LIBRARY_KIND_LABEL,
  MEDIA_LIBRARY_FEATURABLE_KINDS,
  MEDIA_LIBRARY_TRASHABLE_KINDS,
} from "@/lib/media-library-kinds";

/**
 * A single combined, browsable library across every piece of visual
 * content an event has — Gallery photos, approved Memory Wall uploads,
 * AI-generated/uploaded images, Slideshow Video renders, and Video
 * Editor renders. Scope confirmed with the client: Gallery + approved
 * Memory Wall uploads, AI images, Slideshow + edited videos, with bulk
 * feature/delete/download actions (see features/admin/media-library/).
 *
 * Deliberately a read-only aggregation over each feature's own existing
 * tables/services rather than a new shared table — every source keeps
 * its own lifecycle (moderation, job status, quota) exactly as before;
 * this just gives the admin one place to browse and act on all of it at
 * once instead of hopping between five separate pages.
 */

export async function listMediaLibrary(eventId: string): Promise<MediaLibraryItem[]> {
  const [gallery, moderationItems, aiImages, slideshows, videoEdits, timelineMovies] = await Promise.all([
    listGalleryPhotos(eventId),
    listMemoriesForModeration(eventId, "all"),
    listCompletedAiImageJobs(eventId),
    listCompletedSlideshowVideoJobs(eventId),
    listVideoEditJobs(eventId),
    listCompletedTimelineMovieJobs(eventId),
  ]);

  const items: MediaLibraryItem[] = [
    ...gallery.map(
      (p): MediaLibraryItem => ({
        id: p.id,
        kind: "gallery",
        url: p.url,
        caption: p.caption,
        guestName: null,
        featured: null,
        createdAt: p.createdAt,
      }),
    ),
    // Only approved, non-guestbook Memory Wall uploads — guestbook is text,
    // not media, and unapproved content still belongs to the moderation
    // queue (/admin/memories), not the curated library.
    ...moderationItems
      .filter((m) => m.approved && m.kind !== "guestbook" && m.url)
      .map(
        (m): MediaLibraryItem => ({
          id: m.id,
          kind: m.kind as "photo" | "video" | "audio",
          url: m.url!,
          caption: m.caption,
          guestName: m.guestName,
          featured: m.featured,
          createdAt: m.createdAt,
        }),
      ),
    ...aiImages.map(
      (a): MediaLibraryItem => ({
        id: a.id,
        kind: "ai_image",
        url: a.url,
        caption: a.isUpload ? "(uploaded image)" : a.prompt,
        guestName: null,
        featured: null,
        createdAt: a.createdAt,
      }),
    ),
    ...slideshows.map(
      (s): MediaLibraryItem => ({
        id: s.id,
        kind: "slideshow_video",
        url: s.url,
        caption: null,
        guestName: null,
        featured: null,
        createdAt: s.createdAt,
      }),
    ),
    ...videoEdits
      .filter((v) => v.status === "done" && v.resultUrl)
      .map(
        (v): MediaLibraryItem => ({
          id: v.id,
          kind: "video_edit",
          url: v.resultUrl!,
          caption: v.title,
          guestName: null,
          featured: null,
          createdAt: v.createdAt,
        }),
      ),
    ...timelineMovies.map(
      (t): MediaLibraryItem => ({
        id: t.id,
        kind: "timeline_movie",
        url: t.url,
        caption: null,
        guestName: null,
        featured: null,
        createdAt: t.createdAt,
      }),
    ),
  ];

  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

import "server-only";

import { listGalleryPhotos } from "@/services/gallery-photos";
import { listMemoriesForModeration } from "@/services/admin-memories";
import { listCompletedAiImageJobs } from "@/services/ai-image-jobs";
import { listCompletedSlideshowVideoJobs } from "@/services/slideshow-video-jobs";
import { listVideoEditJobs } from "@/services/video-editor";

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
export type MediaLibraryKind = "gallery" | "photo" | "video" | "audio" | "ai_image" | "slideshow_video" | "video_edit";

export const MEDIA_LIBRARY_KIND_LABEL: Record<MediaLibraryKind, string> = {
  gallery: "Gallery",
  photo: "Memory Wall Photo",
  video: "Memory Wall Video",
  audio: "Memory Wall Audio",
  ai_image: "AI Image",
  slideshow_video: "Slideshow Video",
  video_edit: "Video Edit",
};

/** Whether a kind supports the "Feature" toggle — only the guest-facing Memory Wall kinds have a `featured` column (see services/admin-memories.ts's setMemoryFeatured); Gallery and the three admin-generated kinds don't. */
export const MEDIA_LIBRARY_FEATURABLE_KINDS: readonly MediaLibraryKind[] = ["photo", "video", "audio"];

/** Whether a kind is covered by the Recycle Bin (services/recycle-bin.ts) on delete, vs. an immediate hard delete — see each kind's delete branch in features/admin/media-library/actions.ts. */
export const MEDIA_LIBRARY_TRASHABLE_KINDS: readonly MediaLibraryKind[] = ["gallery", "photo", "video", "audio"];

export interface MediaLibraryItem {
  id: string;
  kind: MediaLibraryKind;
  url: string;
  caption: string | null;
  guestName: string | null;
  /** null when the kind doesn't support featuring at all (see MEDIA_LIBRARY_FEATURABLE_KINDS) — distinct from false ("supports it, just not featured"). */
  featured: boolean | null;
  createdAt: string;
}

export async function listMediaLibrary(eventId: string): Promise<MediaLibraryItem[]> {
  const [gallery, moderationItems, aiImages, slideshows, videoEdits] = await Promise.all([
    listGalleryPhotos(eventId),
    listMemoriesForModeration(eventId, "all"),
    listCompletedAiImageJobs(eventId),
    listCompletedSlideshowVideoJobs(eventId),
    listVideoEditJobs(eventId),
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
  ];

  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Client-safe vocabulary for the Media Library (#82) — the kind union,
 * display labels, and the featurable/trashable kind lists. Deliberately
 * split out from services/media-library.ts (which has `import
 * "server-only"` for its actual data-fetching) because these are real
 * runtime constants, not just types — a client component importing
 * MEDIA_LIBRARY_KIND_LABEL from a server-only module pulls that whole
 * module (and its "server-only" guard) into the client bundle and fails
 * the build ("You're importing a component that needs 'server-only'").
 * Types alone (MediaLibraryKind, MediaLibraryItem) would have been
 * erased at compile time and were never the actual problem — only the
 * label map was.
 */
export type MediaLibraryKind =
  | "gallery"
  | "photo"
  | "video"
  | "audio"
  | "ai_image"
  | "slideshow_video"
  | "video_edit"
  | "timeline_movie";

export const MEDIA_LIBRARY_KIND_LABEL: Record<MediaLibraryKind, string> = {
  gallery: "Gallery",
  photo: "Memory Wall Photo",
  video: "Memory Wall Video",
  audio: "Memory Wall Audio",
  ai_image: "AI Image",
  slideshow_video: "Slideshow Video",
  video_edit: "Video Edit",
  timeline_movie: "AI Timeline Movie",
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

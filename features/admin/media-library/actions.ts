"use server";

import { revalidatePath } from "next/cache";

import { requireAdminForEvent } from "@/services/admin-auth";
import { getMemoryEventId, setMemoryFeatured } from "@/services/admin-memories";
import { getRecycleItemEventId, moveToTrash } from "@/services/recycle-bin";
import { deleteAiImageJob, getAiImageJobEventId } from "@/services/ai-image-jobs";
import { deleteSlideshowVideoJob, getSlideshowVideoJobEventId } from "@/services/slideshow-video-jobs";
import { deleteVideoEditJob, getVideoEditJobEventId } from "@/services/video-editor";
import { deleteTimelineMovieJob, getTimelineMovieJobEventId } from "@/services/timeline-movie-jobs";
import { createShareCollection, type ShareCollectionInputItem } from "@/services/share-collections";
import type { MediaLibraryKind } from "@/lib/media-library-kinds";

function revalidateMediaLibraryPaths() {
  revalidatePath("/admin/media-library");
  revalidatePath("/admin/gallery");
  revalidatePath("/admin/memories");
  revalidatePath("/admin/recycle-bin");
  revalidatePath("/admin/ai-image");
  revalidatePath("/admin/slideshow");
  revalidatePath("/admin/video-editor");
  revalidatePath("/admin/timeline-movie");
  revalidatePath("/admin");
  revalidatePath("/");
}

/** Resolves which event a Media Library item belongs to, regardless of which of the five underlying tables it lives in, then confirms the caller is allowed to manage it — same "re-resolve from id, don't trust the client" pattern used throughout the admin (requireAdminForPhoto, requireAdminForMemory, requireAdminForTrashItem). Returns the resolved eventId so callers that need it (the three hard-delete branches below) don't have to look it up twice. */
async function requireAdminForMediaItem(kind: MediaLibraryKind, id: string): Promise<string> {
  let eventId: string | null;
  switch (kind) {
    case "gallery":
      eventId = await getRecycleItemEventId("gallery", id);
      break;
    case "photo":
    case "video":
    case "audio":
      eventId = await getMemoryEventId(kind, id);
      break;
    case "ai_image":
      eventId = await getAiImageJobEventId(id);
      break;
    case "slideshow_video":
      eventId = await getSlideshowVideoJobEventId(id);
      break;
    case "video_edit":
      eventId = await getVideoEditJobEventId(id);
      break;
    case "timeline_movie":
      eventId = await getTimelineMovieJobEventId(id);
      break;
  }
  if (!eventId) throw new Error("Item not found.");
  await requireAdminForEvent(eventId);
  return eventId;
}

/** Only meaningful for photo/video/audio kinds (see MEDIA_LIBRARY_FEATURABLE_KINDS in services/media-library.ts) — the UI never calls this for the other four kinds. */
export async function toggleMediaLibraryFeaturedAction(
  kind: "photo" | "video" | "audio",
  id: string,
  featured: boolean,
) {
  try {
    await requireAdminForMediaItem(kind, id);
    await setMemoryFeatured(kind, id, featured);
    revalidateMediaLibraryPaths();
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

/**
 * Gallery/Memory Wall kinds move to the Recycle Bin (30-day undo window
 * — see services/recycle-bin.ts); the three admin-generated kinds
 * (AI Image, Slideshow Video, Video Edit) aren't in the Recycle Bin's
 * scope and are deleted immediately/non-recoverably instead.
 */
export async function deleteMediaLibraryItemAction(kind: MediaLibraryKind, id: string) {
  try {
    const eventId = await requireAdminForMediaItem(kind, id);
    switch (kind) {
      case "gallery":
      case "photo":
      case "video":
      case "audio":
        await moveToTrash(kind, id);
        break;
      case "ai_image":
        await deleteAiImageJob(eventId, id);
        break;
      case "slideshow_video":
        await deleteSlideshowVideoJob(eventId, id);
        break;
      case "video_edit":
        await deleteVideoEditJob(eventId, id);
        break;
      case "timeline_movie":
        await deleteTimelineMovieJob(eventId, id);
        break;
    }
    revalidateMediaLibraryPaths();
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

/** Bundles the caller's current selection into one shareable link (task #83) — see services/share-collections.ts. Trusts eventId only as far as requireAdminForEvent allows; createShareCollection itself re-verifies every item actually belongs to that event before saving. */
export async function createShareCollectionAction(eventId: string, items: ShareCollectionInputItem[]) {
  try {
    const admin = await requireAdminForEvent(eventId);
    const token = await createShareCollection({ eventId, adminId: admin.id, title: null, items });
    return { success: true as const, data: { token } };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

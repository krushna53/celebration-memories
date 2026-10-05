"use server";
import { assertEventMediaPath, isVideoMedia } from "@/lib/curated-media";

import { revalidatePath } from "next/cache";

import { requireAdminForOrganizerArea } from "@/services/admin-auth";
import { createSignedGalleryUpload } from "@/services/uploads";
import {
  createGalleryPhoto,
  getGalleryPhotoById,
  reorderGalleryPhotos,
  updateGalleryPhoto,
} from "@/services/gallery-photos";
import { moveToTrash } from "@/services/recycle-bin";
import { snapshotGallery } from "@/services/event-snapshots";
import type { GalleryCategory } from "@/features/gallery/gallery-data";
import { suggestGalleryTags, type GalleryTagSuggestion } from "@/lib/ai-gallery-tagger";
import { externalizeMediaLink } from "@/services/external-media";
import { resolveGalleryUpload, type GalleryUploadOptions } from "@/services/gallery-auto-tag";

function revalidateGalleryPaths() {
  revalidatePath("/admin/gallery");
  revalidatePath("/admin/recycle-bin");
  revalidatePath("/admin/media-library");
  revalidatePath("/");
  revalidatePath("/events/[slug]", "page");
  revalidatePath("/p/[kind]/[id]", "page");
}

export async function requestGalleryUploadUrlAction(
  eventId: string,
  fileName: string,
  contentType: string,
  fileSize: number,
) {
  try {
    await requireAdminForOrganizerArea(eventId, "gallery");
    const upload = await createSignedGalleryUpload({ eventId, fileName, contentType, fileSize });
    return { success: true as const, data: upload };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function confirmGalleryUploadAction(
  eventId: string,
  category: GalleryCategory,
  path: string,
  caption: string,
  options?: GalleryUploadOptions,
) {
  try {
    const admin = await requireAdminForOrganizerArea(eventId, "gallery");
    // Best-effort — never let a snapshot failure block the actual save.
    await snapshotGallery(eventId, admin.id).catch((err) => console.error("snapshotGallery failed:", err));
    assertEventMediaPath(eventId, path);
    const resolved = await resolveGalleryUpload({ path, category, caption, options });
    const id = await createGalleryPhoto({ eventId, category: resolved.category, storagePath: path, caption: resolved.caption });
    revalidateGalleryPaths();
    return { success: true as const, data: { id, ...resolved } };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

/** Looks up which event a gallery photo belongs to and confirms the caller is allowed to manage it, before any mutation below — closes the gap where any logged-in admin could edit/delete another client's photos by id alone. */
async function requireAdminForPhoto(id: string) {
  const photo = await getGalleryPhotoById(id);
  if (!photo) throw new Error("Photo not found.");
  const admin = await requireAdminForOrganizerArea(photo.eventId, "gallery");
  return { admin, photo };
}

export async function updateGalleryPhotoAction(
  id: string,
  input: { category?: GalleryCategory; caption?: string | null },
) {
  try {
    const { admin, photo } = await requireAdminForPhoto(id);
    await snapshotGallery(photo.eventId, admin.id).catch((err) => console.error("snapshotGallery failed:", err));
    await updateGalleryPhoto(id, input);
    revalidateGalleryPaths();
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

/**
 * Persist a new sort order for a list of gallery photo ids (all belonging
 * to the same category, in the desired display order). The caller is
 * verified against the first photo's event — if they can manage gallery
 * for that event they can reorder all photos within it.
 */
export async function reorderGalleryPhotosAction(orderedIds: string[]) {
  try {
    if (orderedIds.length === 0) return { success: true as const };
    const first = await getGalleryPhotoById(orderedIds[0]!);
    if (!first) throw new Error("Photo not found.");
    await requireAdminForOrganizerArea(first.eventId, "gallery");
    await reorderGalleryPhotos(orderedIds);
    revalidateGalleryPaths();
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

/** Moves the photo to the Recycle Bin (soft delete) instead of removing it immediately — see services/recycle-bin.ts. It stays recoverable there for 30 days before the automatic purge sweep removes it for good. */
export async function deleteGalleryPhotoAction(id: string) {
  try {
    const { admin, photo } = await requireAdminForPhoto(id);
    await snapshotGallery(photo.eventId, admin.id).catch((err) => console.error("snapshotGallery failed:", err));
    await moveToTrash("gallery", id);
    revalidateGalleryPaths();
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

/**
 * AI suggestion for one photo's category + caption — read-only, nothing
 * is saved. The gallery manager calls this once per photo (a few in
 * parallel) so no single request runs long enough to hit the hosting
 * function time limit, then applies the admin-reviewed results in one
 * go via applyGalleryTagSuggestionsAction.
 */
export async function suggestGalleryTagsAction(id: string) {
  try {
    const { photo } = await requireAdminForPhoto(id);
    // OpenAI fetches the image itself, so it needs a link it can reach.
    if (isVideoMedia(photo.url)) throw new Error("Auto-tagging is available for photos only.");
    const suggestion = await suggestGalleryTags(await externalizeMediaLink(photo.url, { ttlSeconds: 600 }));
    return { success: true as const, data: suggestion };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

/** Saves the reviewed suggestions. Every id is re-checked against `eventId` so a tampered list can't touch another event's photos. */
export async function applyGalleryTagSuggestionsAction(
  eventId: string,
  updates: Array<{ id: string } & GalleryTagSuggestion>,
) {
  try {
    const admin = await requireAdminForOrganizerArea(eventId, "gallery");
    const allowed = new Set(["childhood", "wedding", "family", "friends", "travel", "grandchildren"]);
    const valid: typeof updates = [];
    for (const update of updates) {
      const photo = await getGalleryPhotoById(update.id);
      if (!photo || photo.eventId !== eventId || !allowed.has(update.category)) continue;
      valid.push({ ...update, caption: update.caption.trim().slice(0, 200) });
    }
    if (valid.length === 0) return { success: true as const, data: { applied: 0 } };

    await snapshotGallery(eventId, admin.id).catch((err) => console.error("snapshotGallery failed:", err));
    for (const { id, category, caption } of valid) {
      await updateGalleryPhoto(id, { category, caption: caption || null });
    }
    revalidateGalleryPaths();
    return { success: true as const, data: { applied: valid.length } };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

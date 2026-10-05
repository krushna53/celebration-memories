"use server";
import { assertEventMediaPath } from "@/lib/curated-media";

import { requireDraftEvent } from "@/features/start/draft-auth";
import { createSignedGalleryUpload } from "@/services/uploads";
import { countGalleryPhotos, createGalleryPhoto, deleteGalleryPhoto, getGalleryPhotoById, updateGalleryPhoto } from "@/services/gallery-photos";
import { resolveGalleryUpload, type GalleryUploadOptions } from "@/services/gallery-auto-tag";
import type { GalleryCategory } from "@/features/gallery/gallery-data";

/** AI auto-sorting costs a real API call per photo and a draft has no account to bill — cap it per draft. */
const DRAFT_GALLERY_AUTO_TAG_LIMIT = 60;

/** Draft-token-gated mirrors of features/admin/gallery/actions.ts — see that file and draft-auth.ts. */

export async function draftRequestGalleryUploadUrlAction(
  token: string,
  eventId: string,
  fileName: string,
  contentType: string,
  fileSize: number,
) {
  try {
    const event = await requireDraftEvent(token);
    if (event.id !== eventId) return { success: false as const, error: "This link doesn't match that event." };
    const upload = await createSignedGalleryUpload({ eventId: event.id, fileName, contentType, fileSize });
    return { success: true as const, data: upload };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function draftConfirmGalleryUploadAction(
  token: string,
  eventId: string,
  category: GalleryCategory,
  path: string,
  caption: string,
  options?: GalleryUploadOptions,
) {
  try {
    const event = await requireDraftEvent(token);
    if (event.id !== eventId) return { success: false as const, error: "This link doesn't match that event." };
    assertEventMediaPath(eventId, path);
    const autoTag = Boolean(options?.autoTag) && (await countGalleryPhotos(event.id)) < DRAFT_GALLERY_AUTO_TAG_LIMIT;
    const resolved = await resolveGalleryUpload({ path, category, caption, options: { ...options, autoTag } });
    const id = await createGalleryPhoto({ eventId: event.id, category: resolved.category, storagePath: path, caption: resolved.caption });
    return { success: true as const, data: { id, ...resolved } };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function draftDeleteGalleryPhotoAction(token: string, id: string) {
  try {
    const event = await requireDraftEvent(token);
    const photo = await getGalleryPhotoById(id);
    if (!photo || photo.eventId !== event.id) return { success: false as const, error: "Not found." };
    await deleteGalleryPhoto(id);
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

/** Draft-token-gated mirror of updateGalleryPhotoAction — the wizard's caption/category editor. */
export async function draftUpdateGalleryPhotoAction(
  token: string,
  id: string,
  input: { category?: GalleryCategory; caption?: string | null },
) {
  try {
    const event = await requireDraftEvent(token);
    const photo = await getGalleryPhotoById(id);
    if (!photo || photo.eventId !== event.id) return { success: false as const, error: "Not found." };
    const allowed = new Set(["childhood", "wedding", "family", "friends", "travel", "grandchildren"]);
    if (input.category !== undefined && !allowed.has(input.category)) return { success: false as const, error: "Unknown category." };
    await updateGalleryPhoto(id, {
      category: input.category,
      caption: input.caption === undefined ? undefined : input.caption?.trim().slice(0, 200) || null,
    });
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

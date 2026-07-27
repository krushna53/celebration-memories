"use server";

import { requireDraftEvent } from "@/features/start/draft-auth";
import { createSignedGalleryUpload } from "@/services/uploads";
import { createGalleryPhoto, deleteGalleryPhoto, getGalleryPhotoById } from "@/services/gallery-photos";
import type { GalleryCategory } from "@/features/gallery/gallery-data";

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
) {
  try {
    const event = await requireDraftEvent(token);
    if (event.id !== eventId) return { success: false as const, error: "This link doesn't match that event." };
    await createGalleryPhoto({ eventId: event.id, category, storagePath: path, caption });
    return { success: true as const };
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

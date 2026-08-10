"use server";

import { revalidatePath } from "next/cache";

import { requireAdminForEvent } from "@/services/admin-auth";
import { createSignedGalleryUpload } from "@/services/uploads";
import {
  createGalleryPhoto,
  getGalleryPhotoById,
  updateGalleryPhoto,
} from "@/services/gallery-photos";
import { moveToTrash } from "@/services/recycle-bin";
import { snapshotGallery } from "@/services/event-snapshots";
import type { GalleryCategory } from "@/features/gallery/gallery-data";

function revalidateGalleryPaths() {
  revalidatePath("/admin/gallery");
  revalidatePath("/admin/recycle-bin");
  revalidatePath("/admin/media-library");
  revalidatePath("/");
}

export async function requestGalleryUploadUrlAction(
  eventId: string,
  fileName: string,
  contentType: string,
  fileSize: number,
) {
  try {
    await requireAdminForEvent(eventId);
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
) {
  try {
    const admin = await requireAdminForEvent(eventId);
    // Best-effort — never let a snapshot failure block the actual save.
    await snapshotGallery(eventId, admin.id).catch((err) => console.error("snapshotGallery failed:", err));
    await createGalleryPhoto({ eventId, category, storagePath: path, caption });
    revalidateGalleryPaths();
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

/** Looks up which event a gallery photo belongs to and confirms the caller is allowed to manage it, before any mutation below — closes the gap where any logged-in admin could edit/delete another client's photos by id alone. */
async function requireAdminForPhoto(id: string) {
  const photo = await getGalleryPhotoById(id);
  if (!photo) throw new Error("Photo not found.");
  const admin = await requireAdminForEvent(photo.eventId);
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

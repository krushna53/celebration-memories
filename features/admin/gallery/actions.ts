"use server";

import { revalidatePath } from "next/cache";

import { requireAdminForEvent } from "@/services/admin-auth";
import { createSignedGalleryUpload } from "@/services/uploads";
import {
  createGalleryPhoto,
  deleteGalleryPhoto,
  getGalleryPhotoById,
  updateGalleryPhoto,
} from "@/services/gallery-photos";
import type { GalleryCategory } from "@/features/gallery/gallery-data";

function revalidateGalleryPaths() {
  revalidatePath("/admin/gallery");
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
    await requireAdminForEvent(eventId);
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
  await requireAdminForEvent(photo.eventId);
}

export async function updateGalleryPhotoAction(
  id: string,
  input: { category?: GalleryCategory; caption?: string | null },
) {
  try {
    await requireAdminForPhoto(id);
    await updateGalleryPhoto(id, input);
    revalidateGalleryPaths();
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function deleteGalleryPhotoAction(id: string) {
  try {
    await requireAdminForPhoto(id);
    await deleteGalleryPhoto(id);
    revalidateGalleryPaths();
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

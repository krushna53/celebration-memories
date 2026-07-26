"use server";

import { revalidatePath } from "next/cache";

import { getCurrentAdmin } from "@/services/admin-auth";
import { createSignedGalleryUpload } from "@/services/uploads";
import {
  createGalleryPhoto,
  deleteGalleryPhoto,
  updateGalleryPhoto,
} from "@/services/gallery-photos";
import type { GalleryCategory } from "@/features/gallery/gallery-data";

async function requireAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) throw new Error("Not authorized.");
}

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
    await requireAdmin();
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
    await requireAdmin();
    await createGalleryPhoto({ eventId, category, storagePath: path, caption });
    revalidateGalleryPaths();
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function updateGalleryPhotoAction(
  id: string,
  input: { category?: GalleryCategory; caption?: string | null },
) {
  try {
    await requireAdmin();
    await updateGalleryPhoto(id, input);
    revalidateGalleryPaths();
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function deleteGalleryPhotoAction(id: string) {
  try {
    await requireAdmin();
    await deleteGalleryPhoto(id);
    revalidateGalleryPaths();
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

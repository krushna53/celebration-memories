"use server";

import { revalidatePath } from "next/cache";

import { requireAdminForOrganizerArea } from "@/services/admin-auth";
import { getGalleryPhotoById, getGalleryPhotoPaths } from "@/services/gallery-photos";
import { publicMediaUrl } from "@/services/uploads";
import { externalMediaUrl } from "@/services/external-media";
import { createGalleryPair, deleteGalleryPair } from "@/services/gallery-story";
import { applyGalleryCleanup, previewGalleryCleanup, revertGalleryCleanup, type CropBox } from "@/services/gallery-cleanup";
import { snapshotGallery } from "@/services/event-snapshots";
import { detectPrintBounds } from "@/lib/ai-gallery-tagger";

/**
 * Admin actions for the gallery's storytelling tools — "Then & Now"
 * pairs and scanned-print cleanup. Same result-object convention and
 * per-photo authorization as features/admin/gallery/actions.ts.
 */

function revalidate() {
  revalidatePath("/admin/gallery");
  revalidatePath("/");
}

const fail = (err: unknown) => ({ success: false as const, error: err instanceof Error ? err.message : "Failed." });

async function requireAdminForPhoto(id: string) {
  const photo = await getGalleryPhotoById(id);
  if (!photo) throw new Error("Photo not found.");
  const admin = await requireAdminForOrganizerArea(photo.eventId, "gallery");
  return { admin, photo };
}

export async function createGalleryPairAction(eventId: string, thenPhotoId: string, nowPhotoId: string, caption: string) {
  try {
    await requireAdminForOrganizerArea(eventId, "gallery");
    await createGalleryPair({ eventId, thenPhotoId, nowPhotoId, caption: caption.slice(0, 200) });
    revalidate();
    return { success: true as const };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteGalleryPairAction(eventId: string, pairId: string) {
  try {
    await requireAdminForOrganizerArea(eventId, "gallery");
    await deleteGalleryPair(eventId, pairId);
    revalidate();
    return { success: true as const };
  } catch (err) {
    return fail(err);
  }
}

function validBox(box: CropBox): CropBox {
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return { x: n(box.x), y: n(box.y), width: n(box.width) || 1, height: n(box.height) || 1 };
}

/** The untouched original's URL — the crop editor draws on this, and cleanup always re-crops from it. */
async function originalUrl(photoId: string): Promise<string> {
  const paths = await getGalleryPhotoPaths(photoId);
  if (!paths) throw new Error("Photo not found.");
  return publicMediaUrl("gallery", paths.originalStoragePath ?? paths.storagePath);
}

export async function getCleanupSourceAction(photoId: string) {
  try {
    await requireAdminForPhoto(photoId);
    return { success: true as const, data: await originalUrl(photoId) };
  } catch (err) {
    return fail(err);
  }
}

export async function detectPrintBoundsAction(photoId: string) {
  try {
    await requireAdminForPhoto(photoId);
    const paths = await getGalleryPhotoPaths(photoId);
    if (!paths) throw new Error("Photo not found.");
    // OpenAI fetches the image itself, so it needs a link it can reach.
    const url = await externalMediaUrl("gallery", paths.originalStoragePath ?? paths.storagePath, 600);
    return { success: true as const, data: await detectPrintBounds(url) };
  } catch (err) {
    return fail(err);
  }
}

export async function previewGalleryCleanupAction(photoId: string, box: CropBox, enhance: boolean) {
  try {
    await requireAdminForPhoto(photoId);
    return { success: true as const, data: await previewGalleryCleanup(photoId, validBox(box), enhance) };
  } catch (err) {
    return fail(err);
  }
}

export async function applyGalleryCleanupAction(photoId: string, box: CropBox, enhance: boolean) {
  try {
    const { admin, photo } = await requireAdminForPhoto(photoId);
    await snapshotGallery(photo.eventId, admin.id).catch((err) => console.error("snapshotGallery failed:", err));
    await applyGalleryCleanup(photoId, validBox(box), enhance);
    revalidate();
    return { success: true as const };
  } catch (err) {
    return fail(err);
  }
}

export async function revertGalleryCleanupAction(photoId: string) {
  try {
    const { admin, photo } = await requireAdminForPhoto(photoId);
    await snapshotGallery(photo.eventId, admin.id).catch((err) => console.error("snapshotGallery failed:", err));
    await revertGalleryCleanup(photoId);
    revalidate();
    return { success: true as const };
  } catch (err) {
    return fail(err);
  }
}

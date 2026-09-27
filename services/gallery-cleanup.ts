import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { getGalleryPhotoPaths, setGalleryPhotoFile } from "@/services/gallery-photos";

/**
 * Scanned-print cleanup for gallery photos: crop to the printed picture
 * and (optionally) auto-level contrast/colour. Always works from the
 * untouched original — gallery_photos.original_storage_path, set the
 * first time a photo is cleaned (migration 0062) — so re-cleaning never
 * compounds quality loss and "Revert" is always possible.
 */

export interface CropBox {
  /** Fractions of the (auto-rotated) original image, 0–1. */
  x: number;
  y: number;
  width: number;
  height: number;
}

async function downloadOriginal(photoId: string) {
  const paths = await getGalleryPhotoPaths(photoId);
  if (!paths) throw new Error("Photo not found.");
  const source = paths.originalStoragePath ?? paths.storagePath;
  const { data, error } = await supabaseAdmin().storage.from("gallery").download(source);
  if (error || !data) throw new Error(`Couldn't load the original photo: ${error?.message ?? "empty file"}`);
  return { paths, buffer: Buffer.from(await data.arrayBuffer()) };
}

async function process(buffer: Buffer, box: CropBox, enhance: boolean, maxWidth?: number): Promise<Buffer> {
  // Bake in EXIF rotation first so the box fractions match what the admin saw.
  const oriented = await sharp(buffer).rotate().toBuffer();
  const { width = 0, height = 0 } = await sharp(oriented).metadata();
  if (!width || !height) throw new Error("Couldn't read this image's size.");
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const left = Math.round(clamp(box.x) * width);
  const top = Math.round(clamp(box.y) * height);
  const cropWidth = Math.max(16, Math.min(width - left, Math.round(clamp(box.width) * width)));
  const cropHeight = Math.max(16, Math.min(height - top, Math.round(clamp(box.height) * height)));

  let pipeline = sharp(oriented).extract({ left, top, width: cropWidth, height: cropHeight });
  // Gentle on purpose: +10% contrast around mid-grey, a little colour and sharpness. Full auto-levels
  // (sharp's normalize) stretched faded or flat prints to near-black/white extremes.
  if (enhance) pipeline = pipeline.linear(1.1, -12.8).modulate({ saturation: 1.1, brightness: 1.02 }).sharpen({ sigma: 0.6 });
  if (maxWidth) pipeline = pipeline.resize({ width: maxWidth, withoutEnlargement: true });
  return pipeline.jpeg({ quality: 90, mozjpeg: true }).toBuffer();
}

/** A small JPEG of the result, as a data URL, for the admin to check before saving. Nothing is stored. */
export async function previewGalleryCleanup(photoId: string, box: CropBox, enhance: boolean): Promise<string> {
  const { buffer } = await downloadOriginal(photoId);
  const out = await process(buffer, box, enhance, 900);
  return `data:image/jpeg;base64,${out.toString("base64")}`;
}

/** Saves the cleaned copy as the photo's displayed file, keeping the original for Revert. */
export async function applyGalleryCleanup(photoId: string, box: CropBox, enhance: boolean): Promise<void> {
  const { paths, buffer } = await downloadOriginal(photoId);
  const out = await process(buffer, box, enhance);
  const newPath = `${paths.eventId}/gallery/cleaned-${randomUUID()}.jpg`;
  const storage = supabaseAdmin().storage.from("gallery");
  const { error } = await storage.upload(newPath, out, { contentType: "image/jpeg", upsert: false });
  if (error) throw new Error(`Couldn't save the cleaned photo: ${error.message}`);

  const original = paths.originalStoragePath ?? paths.storagePath;
  await setGalleryPhotoFile(photoId, newPath, original);
  // A previous cleaned copy is no longer referenced by anything.
  if (paths.originalStoragePath) await storage.remove([paths.storagePath]).catch(() => {});
}

/** Back to the untouched original; the cleaned copy is deleted. */
export async function revertGalleryCleanup(photoId: string): Promise<void> {
  const paths = await getGalleryPhotoPaths(photoId);
  if (!paths) throw new Error("Photo not found.");
  if (!paths.originalStoragePath) return;
  await setGalleryPhotoFile(photoId, paths.originalStoragePath, null);
  await supabaseAdmin().storage.from("gallery").remove([paths.storagePath]).catch(() => {});
}

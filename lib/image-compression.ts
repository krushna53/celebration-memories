"use client";

/**
 * Client-side image compression before upload (per CLAUDE.md → "Compress
 * uploads before storing"). Resizes to a max dimension and re-encodes as
 * JPEG via <canvas> — no extra dependency needed. Video/audio compression
 * in the browser would require a much heavier tool (e.g. ffmpeg.wasm) and
 * is out of scope for now; those upload as-is, capped by the size limits
 * in types/memory.ts.
 *
 * Non-image files, or images the browser can't decode (some HEIC cases),
 * are returned unchanged — compression is a best-effort optimisation,
 * never a hard requirement for the upload to proceed.
 */
export async function compressImage(
  file: File,
  { maxDimension = 2000, quality = 0.82 }: { maxDimension?: number; quality?: number } = {},
): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));

    if (scale >= 1 && file.type === "image/jpeg") {
      // Already small enough and already a JPEG — nothing to gain.
      bitmap.close();
      return file;
    }

    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) return file;

    const newName = file.name.replace(/\.\w+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg" });
  } catch {
    // If decoding fails (e.g. some HEIC files in some browsers), fall
    // back to uploading the original — better than blocking the guest.
    return file;
  }
}

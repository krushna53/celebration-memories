"use client";

/**
 * Client-side image compression before upload (per CLAUDE.md → "Compress
 * uploads before storing"). Resizes to a max dimension and re-encodes as
 * JPEG via <canvas> — no extra dependency needed for that part. Video/
 * audio compression in the browser would require a much heavier tool
 * (e.g. ffmpeg.wasm) and is out of scope for now; those upload as-is,
 * capped by the size limits in types/memory.ts.
 *
 * HEIC/HEIF (the default format on iPhone cameras) is converted to JPEG
 * first via heic2any — Chrome, Firefox, and virtually every social
 * platform's web uploader either can't display or won't accept raw HEIC,
 * so leaving it as-is would silently produce photos guests can see on
 * their own iPhone but nowhere else. This is what makes every uploaded
 * photo reliably shareable to Instagram/Facebook/X/etc afterward.
 */
export async function compressImage(
  file: File,
  { maxDimension = 2000, quality = 0.82 }: { maxDimension?: number; quality?: number } = {},
): Promise<File> {
  if (!file.type.startsWith("image/") && !isHeic(file)) {
    return file;
  }
  if (file.type === "image/svg+xml") {
    return file;
  }

  let source: File | Blob = file;

  if (isHeic(file)) {
    try {
      const heic2any = (await import("heic2any")).default;
      const converted = await heic2any({ blob: file, toType: "image/jpeg", quality });
      source = Array.isArray(converted) ? converted[0]! : converted;
    } catch (err) {
      console.error("HEIC conversion failed, uploading original file:", err);
      // Better to let the guest's upload succeed than block them entirely
      // — but flag it, since a raw HEIC file won't display in most places.
      return file;
    }
  }

  try {
    const bitmap = await createImageBitmap(source);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));

    if (scale >= 1 && !isHeic(file) && file.type === "image/jpeg") {
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
    // If decoding still fails for some other reason, fall back to
    // whatever we have (post-HEIC-conversion if that succeeded) rather
    // than blocking the guest's upload entirely.
    return source instanceof File ? source : file;
  }
}

function isHeic(file: File): boolean {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return (
    type === "image/heic" ||
    type === "image/heif" ||
    type === "image/heic-sequence" ||
    type === "image/heif-sequence" ||
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  );
}

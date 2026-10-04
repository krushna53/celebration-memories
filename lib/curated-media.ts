/** Gallery and milestone videos use canonical .mp4 names in the existing gallery bucket. */
export const CURATED_MEDIA_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,.mp4";
export const CURATED_VIDEO_MAX_BYTES = 300 * 1024 * 1024;

export function isVideoMedia(url: string | null | undefined): boolean {
  return !!url && /\.mp4$/i.test(url.split(/[?#]/)[0]!);
}

export function curatedMediaFile(fileName: string, contentType: string, fileSize: number) {
  const type = contentType.split(";")[0]!.trim().toLowerCase() || (/\.mp4$/i.test(fileName) ? "video/mp4" : "");
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif", "video/mp4": "mp4",
  };
  const extension = extensions[type];
  if (!extension) throw new Error("Choose a photo or an MP4 video.");
  const video = type === "video/mp4";
  if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > (video ? CURATED_VIDEO_MAX_BYTES : 50 * 1024 * 1024)) {
    throw new Error(`Choose a file up to ${video ? "300MB" : "50MB"}.`);
  }
  return { contentType: type, fileName: `${fileName.replace(/\.[^.]*$/, "")}.${extension}` };
}

export function assertEventMediaPath(eventId: string, path: string) {
  if (!path.startsWith(`${eventId}/`) || path.includes("..") || path.includes("\\") || path.includes("%")) {
    throw new Error("This upload does not belong to this event.");
  }
}

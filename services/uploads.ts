import "server-only";
import { randomUUID } from "node:crypto";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { ACCEPTED_MIME_TYPES, UPLOAD_LIMITS, type MemoryKind } from "@/types/memory";

const BUCKET_BY_KIND: Record<"photo" | "video" | "audio", string> = {
  photo: "photos",
  video: "videos",
  audio: "audio",
};

const TABLE_BY_KIND: Record<"photo" | "video" | "audio", string> = {
  photo: "photos",
  video: "videos",
  audio: "audio",
};

/** Rough per-guest ceiling so one link can't be used to spam Storage. */
const MAX_UPLOADS_PER_INVITEE = 40;

export class UploadValidationError extends Error {}

function sanitizeFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, "-")
    .slice(-80);
}

/**
 * Issues a Supabase Storage signed upload URL for a guest's file, after
 * validating the file against the type/size limits from CLAUDE.md and a
 * basic per-invitee upload cap (a lightweight stand-in for real rate
 * limiting — good enough for a family-event site with no external
 * rate-limit service configured).
 */
export async function createSignedMediaUpload(params: {
  inviteeId: string;
  eventId: string;
  kind: "photo" | "video" | "audio";
  fileName: string;
  contentType: string;
  fileSize: number;
}) {
  const { inviteeId, eventId, kind, fileName, contentType, fileSize } = params;

  const acceptedTypes: readonly string[] = ACCEPTED_MIME_TYPES[kind];
  if (!acceptedTypes.includes(contentType)) {
    throw new UploadValidationError(
      `Unsupported file type for ${kind}: ${contentType}`,
    );
  }

  const limit = UPLOAD_LIMITS[kind];
  if (fileSize > limit.maxBytes) {
    throw new UploadValidationError(
      `File is too large — ${kind} uploads are limited to ${limit.label}.`,
    );
  }

  const client = supabaseAdmin();
  const table = TABLE_BY_KIND[kind];
  const { count } = await client
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("invitee_id", inviteeId);

  if ((count ?? 0) >= MAX_UPLOADS_PER_INVITEE) {
    throw new UploadValidationError(
      "You've reached the upload limit for this invitation link.",
    );
  }

  const bucket = BUCKET_BY_KIND[kind];
  const path = `${eventId}/${inviteeId}/${randomUUID()}-${sanitizeFileName(fileName)}`;

  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUploadUrl(path);

  if (error || !data) {
    throw new Error(`Failed to create signed upload URL: ${error?.message}`);
  }

  return { bucket, path, token: data.token, signedUrl: data.signedUrl };
}

/**
 * Records a completed upload (called after the browser has finished the
 * direct-to-Storage PUT). New rows are always `approved = false` — they
 * enter the Phase 5 admin moderation queue before appearing on the
 * public Memory Wall.
 */
export async function confirmMediaUpload(params: {
  inviteeId: string;
  eventId: string;
  kind: "photo" | "video" | "audio";
  path: string;
  caption?: string;
}) {
  const { inviteeId, eventId, kind, path, caption } = params;
  const table = TABLE_BY_KIND[kind];

  const { error } = await supabaseAdmin()
    .from(table)
    .insert({
      invitee_id: inviteeId,
      event_id: eventId,
      storage_path: path,
      caption: caption || null,
    });

  if (error) {
    throw new Error(`Failed to save ${kind} upload: ${error.message}`);
  }
}

export function publicMediaUrl(bucket: string, path: string): string {
  const { data } = supabaseAdmin().storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Same signed-upload pattern as createSignedMediaUpload, but for
 * admin-curated content (the site Gallery) rather than guest uploads —
 * no invitee/per-guest cap, targets the `gallery` bucket. Callers are
 * responsible for checking `getCurrentAdmin()` before calling this.
 */
export async function createSignedGalleryUpload(params: {
  eventId: string;
  fileName: string;
  contentType: string;
  fileSize: number;
}) {
  const { eventId, fileName, contentType, fileSize } = params;

  const acceptedTypes: readonly string[] = ACCEPTED_MIME_TYPES.photo;
  if (!acceptedTypes.includes(contentType)) {
    throw new UploadValidationError(`Unsupported image type: ${contentType}`);
  }

  const limit = UPLOAD_LIMITS.photo;
  if (fileSize > limit.maxBytes) {
    throw new UploadValidationError(`File is too large — limited to ${limit.label}.`);
  }

  const path = `${eventId}/gallery/${randomUUID()}-${sanitizeFileName(fileName)}`;

  const { data, error } = await supabaseAdmin().storage
    .from("gallery")
    .createSignedUploadUrl(path);

  if (error || !data) {
    throw new Error(`Failed to create signed upload URL: ${error?.message}`);
  }

  return { bucket: "gallery", path, token: data.token, signedUrl: data.signedUrl };
}

/**
 * Same signed-upload pattern, for the single organizer-chosen "link
 * preview" image used as the Open Graph/Twitter card image (see
 * lib/event-metadata.ts). Stored in the `gallery` bucket under a
 * dedicated prefix so it doesn't show up as a Gallery section photo.
 */
export async function createSignedShareImageUpload(params: {
  eventId: string;
  fileName: string;
  contentType: string;
  fileSize: number;
}) {
  const { eventId, fileName, contentType, fileSize } = params;

  const acceptedTypes: readonly string[] = ACCEPTED_MIME_TYPES.photo;
  if (!acceptedTypes.includes(contentType)) {
    throw new UploadValidationError(`Unsupported image type: ${contentType}`);
  }

  const limit = UPLOAD_LIMITS.photo;
  if (fileSize > limit.maxBytes) {
    throw new UploadValidationError(`File is too large — limited to ${limit.label}.`);
  }

  const path = `${eventId}/share-image/${randomUUID()}-${sanitizeFileName(fileName)}`;

  const { data, error } = await supabaseAdmin().storage
    .from("gallery")
    .createSignedUploadUrl(path);

  if (error || !data) {
    throw new Error(`Failed to create signed upload URL: ${error?.message}`);
  }

  return { bucket: "gallery", path, token: data.token, signedUrl: data.signedUrl };
}

/**
 * Uploads an already-in-memory image (e.g. from OpenAI's image API —
 * see lib/ai-image.ts) directly to the `gallery` bucket, server-side.
 * Unlike the signed-upload flow above, there's no browser round trip:
 * the caller already has the bytes, so this just writes them straight
 * to Storage via the service-role client.
 */
export async function uploadGeneratedImage(params: {
  eventId: string;
  buffer: Buffer;
  contentType: string;
}): Promise<{ path: string; url: string }> {
  const { eventId, buffer, contentType } = params;
  const ext = contentType === "image/png" ? "png" : "jpg";
  const path = `${eventId}/ai-generated/${randomUUID()}.${ext}`;

  const { error } = await supabaseAdmin()
    .storage.from("gallery")
    .upload(path, buffer, { contentType, upsert: false });

  if (error) {
    throw new Error(`Failed to save generated image: ${error.message}`);
  }

  return { path, url: publicMediaUrl("gallery", path) };
}

/**
 * Same signed-upload pattern, for the payment QR code shown at /pay
 * (see /admin/payment-settings). Platform-level, not per-event — stored
 * under its own prefix in the `gallery` bucket rather than a dedicated
 * bucket, matching how share-image/ai-generated already reuse it.
 */
export async function createSignedPaymentQrUpload(params: {
  fileName: string;
  contentType: string;
  fileSize: number;
}) {
  const { fileName, contentType, fileSize } = params;

  const acceptedTypes: readonly string[] = ACCEPTED_MIME_TYPES.photo;
  if (!acceptedTypes.includes(contentType)) {
    throw new UploadValidationError(`Unsupported image type: ${contentType}`);
  }

  const limit = UPLOAD_LIMITS.photo;
  if (fileSize > limit.maxBytes) {
    throw new UploadValidationError(`File is too large — limited to ${limit.label}.`);
  }

  const path = `platform/payment-qr/${randomUUID()}-${sanitizeFileName(fileName)}`;

  const { data, error } = await supabaseAdmin().storage
    .from("gallery")
    .createSignedUploadUrl(path);

  if (error || !data) {
    throw new Error(`Failed to create signed upload URL: ${error?.message}`);
  }

  return { bucket: "gallery", path, token: data.token, signedUrl: data.signedUrl };
}

/**
 * Signed upload for the optional link-preview video (og:video —
 * see lib/event-metadata.ts). Deliberately stricter than a regular
 * Gallery/guest video upload: MP4 only (the one format every crawler
 * that does support og:video, i.e. Telegram, reliably plays inline),
 * and capped much smaller than the 250MB guest-video limit since this
 * file gets fetched synchronously by link-preview crawlers, which
 * have their own tight timeouts — a small, fast-loading clip works far
 * more reliably than a long one.
 */
const MAX_SHARE_VIDEO_BYTES = 20 * 1024 * 1024;

export async function createSignedShareVideoUpload(params: {
  eventId: string;
  fileName: string;
  contentType: string;
  fileSize: number;
}) {
  const { eventId, fileName, contentType, fileSize } = params;

  if (contentType !== "video/mp4") {
    throw new UploadValidationError("Only MP4 video is supported for the link-preview video.");
  }

  if (fileSize > MAX_SHARE_VIDEO_BYTES) {
    throw new UploadValidationError("File is too large — link-preview videos are limited to 20MB.");
  }

  const path = `${eventId}/share-video/${randomUUID()}-${sanitizeFileName(fileName)}`;

  const { data, error } = await supabaseAdmin().storage
    .from("gallery")
    .createSignedUploadUrl(path);

  if (error || !data) {
    throw new Error(`Failed to create signed upload URL: ${error?.message}`);
  }

  return { bucket: "gallery", path, token: data.token, signedUrl: data.signedUrl };
}

export type { MemoryKind };

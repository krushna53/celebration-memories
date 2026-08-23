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
  const { inviteeId, eventId, kind, fileName, fileSize } = params;

  // Strip codec parameters (e.g. "video/webm;codecs=vp8,opus" ->
  // "video/webm") before checking — in-browser recordings normalize
  // this at the source too (see hooks/use-media-recorder.ts), but this
  // is a second, server-side safety net for any other client (e.g. the
  // mobile app) that might send the fuller MIME string.
  const contentType = (params.contentType.split(";")[0] ?? params.contentType).trim();

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
 * public Memory Wall. Returns the new row's id so the guest's own
 * upload queue can later offer to delete it (see deleteOwnMediaUpload)
 * without needing any broader read/write access to the table.
 */
export async function confirmMediaUpload(params: {
  inviteeId: string;
  eventId: string;
  kind: "photo" | "video" | "audio";
  path: string;
  caption?: string;
}): Promise<{ id: string }> {
  const { inviteeId, eventId, kind, path, caption } = params;
  const table = TABLE_BY_KIND[kind];

  const { data, error } = await supabaseAdmin()
    .from(table)
    .insert({
      invitee_id: inviteeId,
      event_id: eventId,
      storage_path: path,
      caption: caption || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to save ${kind} upload: ${error?.message}`);
  }

  return { id: data.id as string };
}

/**
 * Lets a guest undo their own just-submitted photo/video/audio — e.g.
 * "that take didn't come out well, let me delete it and record again."
 * Scoped to their own invitee id (re-resolved from their token by the
 * caller, same as every other guest-facing action here) so this can
 * never be used to delete someone else's memory even if a media id were
 * guessed. Deletes the Storage object first, then the DB row; a failed
 * Storage delete is logged but doesn't block removing the row — a guest
 * clicking "Delete" expects it gone from their queue and the admin
 * moderation list, and a rare orphaned Storage object is a much smaller
 * problem than the delete silently not working.
 */
export async function deleteOwnMediaUpload(params: {
  inviteeId: string;
  kind: "photo" | "video" | "audio";
  mediaId: string;
}): Promise<void> {
  const { inviteeId, kind, mediaId } = params;
  const table = TABLE_BY_KIND[kind];
  const bucket = BUCKET_BY_KIND[kind];
  const client = supabaseAdmin();

  const { data: row, error: fetchError } = await client
    .from(table)
    .select("id, invitee_id, storage_path")
    .eq("id", mediaId)
    .maybeSingle();

  if (fetchError || !row) {
    throw new Error("That memory couldn't be found.");
  }
  if (row.invitee_id !== inviteeId) {
    throw new Error("That memory doesn't belong to this invitation.");
  }

  const { error: storageError } = await client.storage.from(bucket).remove([row.storage_path]);
  if (storageError) {
    console.error(`deleteOwnMediaUpload: failed to remove ${kind} storage object:`, storageError.message);
  }

  const { error: deleteError } = await client.from(table).delete().eq("id", mediaId);
  if (deleteError) {
    throw new Error(`Failed to delete ${kind} upload: ${deleteError.message}`);
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
 * Same signed-upload pattern, for an admin who'd rather upload their own
 * invitation image than generate one with AI (see the "Upload your own"
 * tab in features/admin/ai-image/ai-image-generator.tsx). Stored under
 * its own prefix in the `gallery` bucket, same as the AI-generated
 * counterpart (uploadGeneratedImage below) — the two are treated
 * identically once uploaded: same {url, path} shape, same "Use as Link
 * Preview Image" / "Add to Gallery" / Download actions.
 */
export async function createSignedAiImageUpload(params: {
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

  const path = `${eventId}/ai-image-upload/${randomUUID()}-${sanitizeFileName(fileName)}`;

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
 * and capped much smaller than the 1GB guest-video limit since this
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

/**
 * Same signed-upload pattern as createSignedPaymentQrUpload — platform-
 * level, not per-event, for the optional photo on a public testimonial
 * submission (features/testimonials/share-experience-form.tsx). Anyone
 * can call this (no admin/invitee check), same as the testimonial
 * submission itself; the resulting row is unapproved until the owner
 * reviews it at /admin/testimonials, so an unwanted image never goes
 * public even though the upload itself is open.
 */
export async function createSignedTestimonialPhotoUpload(params: {
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

  const path = `platform/testimonials/${randomUUID()}-${sanitizeFileName(fileName)}`;

  const { data, error } = await supabaseAdmin().storage
    .from("gallery")
    .createSignedUploadUrl(path);

  if (error || !data) {
    throw new Error(`Failed to create signed upload URL: ${error?.message}`);
  }

  return { bucket: "gallery", path, token: data.token, signedUrl: data.signedUrl };
}

/** Same signed-upload pattern, for an optional photo attached to a Timeline milestone (see services/timeline.ts, /admin/timeline). */
export async function createSignedTimelineImageUpload(params: {
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

  const path = `${eventId}/timeline/${randomUUID()}-${sanitizeFileName(fileName)}`;

  const { data, error } = await supabaseAdmin().storage
    .from("gallery")
    .createSignedUploadUrl(path);

  if (error || !data) {
    throw new Error(`Failed to create signed upload URL: ${error?.message}`);
  }

  return { bucket: "gallery", path, token: data.token, signedUrl: data.signedUrl };
}

/**
 * Same signed-upload pattern, for an optional background-music track for
 * the Slideshow Video tool (/admin/slideshow). Stored in the
 * `audio` STORAGE bucket — not the `gallery` bucket used by the other
 * admin-curated uploads above, because Supabase Storage buckets each
 * have their own `allowed_mime_types` restriction configured at the
 * bucket level (enforced on every signed-URL upload, regardless of
 * caller), and `gallery` only permits image types. `audio` already
 * permits exactly the types ACCEPTED_MIME_TYPES.audio does. This is
 * only reusing the `audio` bucket's STORAGE namespace — nothing is
 * inserted into the `audio` DATABASE TABLE (that table is for
 * guest-submitted voice messages and has an invitee_id moderation
 * flow that doesn't apply here), so this still doesn't need a confirm
 * step or DB row: the caller just needs the resulting public URL to
 * hand to the generate-slideshow-video Edge Function.
 */
export async function createSignedSlideshowMusicUpload(params: {
  eventId: string;
  fileName: string;
  contentType: string;
  fileSize: number;
}) {
  const { eventId, fileName, contentType, fileSize } = params;

  const acceptedTypes: readonly string[] = ACCEPTED_MIME_TYPES.audio;
  if (!acceptedTypes.includes(contentType)) {
    throw new UploadValidationError(`Unsupported audio type: ${contentType}`);
  }

  const limit = UPLOAD_LIMITS.audio;
  if (fileSize > limit.maxBytes) {
    throw new UploadValidationError(`File is too large — limited to ${limit.label}.`);
  }

  const path = `${eventId}/slideshow-music/${randomUUID()}-${sanitizeFileName(fileName)}`;

  const { data, error } = await supabaseAdmin().storage
    .from("audio")
    .createSignedUploadUrl(path);

  if (error || !data) {
    throw new Error(`Failed to create signed upload URL: ${error?.message}`);
  }

  return { bucket: "audio", path, token: data.token, signedUrl: data.signedUrl };
}

/**
 * Same signed-upload pattern, for an admin-supplied "highlight reel" —
 * a single, already-edited video (e.g. all the guest videos combined
 * with name labels using an outside tool) that plays as its own slide
 * on the Big Screen Display (see lib/build-display-slides.ts). Capped
 * the same as a guest video upload — a compiled reel can reasonably run
 * a few minutes, unlike the tiny og:video link-preview clip.
 */
export async function createSignedHighlightReelUpload(params: {
  eventId: string;
  fileName: string;
  contentType: string;
  fileSize: number;
}) {
  const { eventId, fileName, contentType, fileSize } = params;

  const acceptedTypes: readonly string[] = ACCEPTED_MIME_TYPES.video;
  if (!acceptedTypes.includes(contentType)) {
    throw new UploadValidationError(`Unsupported video type: ${contentType}`);
  }

  const limit = UPLOAD_LIMITS.video;
  if (fileSize > limit.maxBytes) {
    throw new UploadValidationError(`File is too large — limited to ${limit.label}.`);
  }

  const path = `${eventId}/highlight-reel/${randomUUID()}-${sanitizeFileName(fileName)}`;

  const { data, error } = await supabaseAdmin().storage
    .from("gallery")
    .createSignedUploadUrl(path);

  if (error || !data) {
    throw new Error(`Failed to create signed upload URL: ${error?.message}`);
  }

  return { bucket: "gallery", path, token: data.token, signedUrl: data.signedUrl };
}

/**
 * Same signed-upload pattern, for a video a client uploads specifically
 * to bring into the Video Editor (features/admin/video-editor/) — e.g.
 * a separately-shot intro clip, distinct from anything a guest has
 * submitted. Uses the dedicated `videos` bucket (1GB limit, same as
 * guest video uploads) rather than `gallery` (50MB) since editing
 * source footage can reasonably be large/high-bitrate. The caller
 * (confirmVideoEditorUploadAction) inserts the video_editor_uploads
 * row after the browser's PUT succeeds — this function only mints the
 * signed URL, same two-step pattern as every other upload path in this
 * file.
 */
export async function createSignedVideoEditorUpload(params: {
  eventId: string;
  fileName: string;
  contentType: string;
  fileSize: number;
}) {
  const { eventId, fileName, contentType, fileSize } = params;

  const acceptedTypes: readonly string[] = ACCEPTED_MIME_TYPES.video;
  if (!acceptedTypes.includes(contentType)) {
    throw new UploadValidationError(`Unsupported video type: ${contentType}`);
  }

  const limit = UPLOAD_LIMITS.video;
  if (fileSize > limit.maxBytes) {
    throw new UploadValidationError(`File is too large — limited to ${limit.label}.`);
  }

  const path = `${eventId}/video-editor-uploads/${randomUUID()}-${sanitizeFileName(fileName)}`;

  const { data, error } = await supabaseAdmin().storage
    .from("videos")
    .createSignedUploadUrl(path);

  if (error || !data) {
    throw new Error(`Failed to create signed upload URL: ${error?.message}`);
  }

  return { bucket: "videos", path, token: data.token, signedUrl: data.signedUrl };
}

/**
 * Same signed-upload pattern, for an admin uploading their own pre-made
 * video directly as an event's AI Timeline Movie (features/admin/
 * timeline-movie/) instead of generating one via HeyGen — see
 * services/timeline-movie-jobs.ts's createUploadedTimelineMovieJob.
 * Uses the `videos` bucket, same as every other video upload in this
 * file (except the platform-level feature video, which isn't event-
 * scoped).
 */
export async function createSignedTimelineMovieUpload(params: {
  eventId: string;
  fileName: string;
  contentType: string;
  fileSize: number;
}) {
  const { eventId, fileName, contentType, fileSize } = params;

  if (contentType !== "video/mp4" && contentType !== "video/quicktime") {
    throw new UploadValidationError("Only MP4 or MOV video is supported for the Timeline Movie.");
  }

  const limit = UPLOAD_LIMITS.video;
  if (fileSize > limit.maxBytes) {
    throw new UploadValidationError(`File is too large — limited to ${limit.label}.`);
  }

  const path = `${eventId}/timeline-movie/${randomUUID()}-${sanitizeFileName(fileName)}`;

  const { data, error } = await supabaseAdmin().storage.from("videos").createSignedUploadUrl(path);
  if (error || !data) {
    throw new Error(`Failed to create signed upload URL: ${error?.message}`);
  }

  return { bucket: "videos", path, token: data.token, signedUrl: data.signedUrl };
}

/**
 * Same signed-upload pattern, for a Marketplace vendor's own profile/
 * cover/gallery photos (see features/business/*). Stored in the
 * dedicated `business` bucket rather than reusing `gallery`, since
 * vendor content is unrelated to any one event's Gallery/Storage
 * lifecycle. Scoped by businessId (not eventId) in the storage path.
 * Callers are responsible for checking requireBusinessAccount() and
 * listing ownership (assertOwnsListing) before calling this.
 */
export async function createSignedBusinessImageUpload(params: {
  businessId: string;
  fileName: string;
  contentType: string;
  fileSize: number;
}) {
  const { businessId, fileName, contentType, fileSize } = params;

  const acceptedTypes: readonly string[] = ACCEPTED_MIME_TYPES.photo;
  if (!acceptedTypes.includes(contentType)) {
    throw new UploadValidationError(`Unsupported image type: ${contentType}`);
  }

  const limit = UPLOAD_LIMITS.photo;
  if (fileSize > limit.maxBytes) {
    throw new UploadValidationError(`File is too large — limited to ${limit.label}.`);
  }

  const path = `${businessId}/${randomUUID()}-${sanitizeFileName(fileName)}`;

  const { data, error } = await supabaseAdmin().storage.from("business").createSignedUploadUrl(path);
  if (error || !data) {
    throw new Error(`Failed to create signed upload URL: ${error?.message}`);
  }

  return { bucket: "business", path, token: data.token, signedUrl: data.signedUrl };
}

/**
 * Same signed-upload pattern, for the owner's platform-level "See It In
 * Action" feature video (services/platform-video-settings.ts) — not
 * scoped to any event, unlike every other video upload in this file.
 * Uses the `videos` bucket (same 1GB limit as a guest video upload) so
 * a marketing/product-tour video has plenty of room; restricted to
 * MP4/MOV only (not webm) since that bucket's own Storage-level
 * `allowed_mime_types` only permits those two — see this file's header
 * comment on ACCEPTED_MIME_TYPES.video for why webm is accepted at the
 * application layer for guest recordings but was never added to the
 * bucket itself.
 */
export async function createSignedPlatformVideoUpload(params: {
  fileName: string;
  contentType: string;
  fileSize: number;
}) {
  const { fileName, contentType, fileSize } = params;

  if (contentType !== "video/mp4" && contentType !== "video/quicktime") {
    throw new UploadValidationError("Only MP4 or MOV video is supported for the feature video.");
  }

  const limit = UPLOAD_LIMITS.video;
  if (fileSize > limit.maxBytes) {
    throw new UploadValidationError(`File is too large — limited to ${limit.label}.`);
  }

  const path = `platform/feature-video/${randomUUID()}-${sanitizeFileName(fileName)}`;

  const { data, error } = await supabaseAdmin().storage.from("videos").createSignedUploadUrl(path);
  if (error || !data) {
    throw new Error(`Failed to create signed upload URL: ${error?.message}`);
  }

  return { bucket: "videos", path, token: data.token, signedUrl: data.signedUrl };
}

/**
 * Same signed-upload pattern as createSignedTestimonialPhotoUpload —
 * platform-level, not per-event, for a Custom Form's optional cover
 * photo (features/forms/). Gated by the builder's draft_token check in
 * the calling Server Action, not here — this function just mints the
 * URL, same as every other upload path in this file.
 */
export async function createSignedCustomFormCoverUpload(params: {
  formId: string;
  fileName: string;
  contentType: string;
  fileSize: number;
}) {
  const { formId, fileName, contentType, fileSize } = params;

  const acceptedTypes: readonly string[] = ACCEPTED_MIME_TYPES.photo;
  if (!acceptedTypes.includes(contentType)) {
    throw new UploadValidationError(`Unsupported image type: ${contentType}`);
  }

  const limit = UPLOAD_LIMITS.photo;
  if (fileSize > limit.maxBytes) {
    throw new UploadValidationError(`File is too large — limited to ${limit.label}.`);
  }

  const path = `custom-forms/${formId}/cover/${randomUUID()}-${sanitizeFileName(fileName)}`;

  const { data, error } = await supabaseAdmin().storage
    .from("gallery")
    .createSignedUploadUrl(path);

  if (error || !data) {
    throw new Error(`Failed to create signed upload URL: ${error?.message}`);
  }

  return { bucket: "gallery", path, token: data.token, signedUrl: data.signedUrl };
}

/**
 * Admin-side equivalents of createSignedMediaUpload / confirmMediaUpload.
 * Unlike the guest flow these are not invitee-scoped — the upload is
 * attributed to the admin account that made it (uploaded_by_admin_id).
 * The resulting DB row is inserted with approved = true immediately,
 * since the admin is the one moderating content, not subject to it.
 * No per-user upload count cap applies (admins can upload freely).
 */
export async function createSignedAdminMediaUpload(params: {
  adminId: string;
  eventId: string;
  kind: "photo" | "video" | "audio";
  fileName: string;
  contentType: string;
  fileSize: number;
}) {
  const { adminId, eventId, kind, fileName, fileSize } = params;
  const contentType = (params.contentType.split(";")[0] ?? params.contentType).trim();

  const acceptedTypes: readonly string[] = ACCEPTED_MIME_TYPES[kind];
  if (!acceptedTypes.includes(contentType)) {
    throw new UploadValidationError(`Unsupported file type for ${kind}: ${contentType}`);
  }

  const limit = UPLOAD_LIMITS[kind];
  if (fileSize > limit.maxBytes) {
    throw new UploadValidationError(`File is too large — ${kind} uploads are limited to ${limit.label}.`);
  }

  const bucket = BUCKET_BY_KIND[kind];
  const path = `${eventId}/admin-${adminId}/${randomUUID()}-${sanitizeFileName(fileName)}`;

  const { data, error } = await supabaseAdmin().storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) {
    throw new Error(`Failed to create signed upload URL: ${error?.message}`);
  }

  return { bucket, path, token: data.token, signedUrl: data.signedUrl };
}

export async function confirmAdminMediaUpload(params: {
  adminId: string;
  eventId: string;
  kind: "photo" | "video" | "audio";
  path: string;
  caption?: string;
}): Promise<{ id: string }> {
  const { adminId, eventId, kind, path, caption } = params;
  const table = TABLE_BY_KIND[kind];

  const { data, error } = await supabaseAdmin()
    .from(table)
    .insert({
      uploaded_by_admin_id: adminId,
      event_id: eventId,
      storage_path: path,
      caption: caption || null,
      approved: true, // admin uploads skip the moderation queue
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to save ${kind} upload: ${error?.message}`);
  }
  return { id: data.id as string };
}

export async function submitAdminGuestbookNote(params: {
  adminId: string;
  eventId: string;
  guestName: string;
  message: string;
  country?: string;
}): Promise<void> {
  const { adminId, eventId, guestName, message, country } = params;

  const { error } = await supabaseAdmin().from("guestbook").insert({
    uploaded_by_admin_id: adminId,
    event_id: eventId,
    guest_name: guestName,
    message,
    country: country || null,
    consent_at: new Date().toISOString(),
    approved: true,
  });

  if (error) {
    throw new Error(`Failed to save note: ${error.message}`);
  }
}

export type { MemoryKind };

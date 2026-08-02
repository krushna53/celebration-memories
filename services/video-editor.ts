import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { publicMediaUrl } from "@/services/uploads";
import { listGalleryPhotos } from "@/services/gallery-photos";
import { listMilestones } from "@/services/timeline";

/**
 * Backs the Video Editor's media bin (features/admin/video-editor/) — a
 * second, separate Shotstack-powered feature alongside Slideshow Video
 * (services/slideshow-video-jobs.ts), which only offers Gallery +
 * Timeline photos as slides. This one is a full manual timeline editor
 * (the @shotstack/shotstack-studio SDK, embedded client-side — see
 * features/admin/video-editor/video-editor-workspace.tsx), so its media
 * bin deliberately pulls from every source an event has: Gallery
 * photos, Timeline photos, Memory Wall guest photos/videos (regardless
 * of moderation status — this is an internal admin tool, not the
 * public Memory Wall, so unapproved content is still shown, just
 * badged), and the client's own custom video_editor_uploads.
 */

export type VideoEditorClipKind = "photo" | "video";
export type VideoEditorClipSource = "gallery" | "timeline" | "memory-wall" | "upload";

export interface VideoEditorClip {
  /** Prefixed per source (e.g. "gallery-<uuid>") so ids can't collide once merged into one list. */
  id: string;
  kind: VideoEditorClipKind;
  source: VideoEditorClipSource;
  url: string;
  /** For videos, a still to show in the media bin grid before the SDK itself generates a real thumbnail. Always null today — Gallery/Timeline/uploads have no separate thumbnail asset. */
  thumbnailUrl: string | null;
  label: string | null;
  /** True for every source except unmoderated Memory Wall content — see the moderation badge this drives in the picker UI. */
  approved: boolean;
  createdAt: string;
}

interface WallMediaRow {
  id: string;
  storage_path: string;
  caption: string | null;
  approved: boolean;
  created_at: string;
}

async function fetchWallMedia(
  eventId: string,
  table: "photos" | "videos",
  bucket: string,
): Promise<WallMediaRow[]> {
  const { data, error } = await supabaseAdmin()
    .from(table)
    .select("id, storage_path, caption, approved, created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(`video-editor: failed to load Memory Wall ${table}:`, error.message);
    return [];
  }
  // bucket param intentionally unused here — kept for call-site clarity, mapping happens in the caller.
  void bucket;
  return data as WallMediaRow[];
}

export async function listVideoEditorMediaLibrary(eventId: string): Promise<VideoEditorClip[]> {
  const [galleryPhotos, milestones, wallPhotos, wallVideos, uploads] = await Promise.all([
    listGalleryPhotos(eventId),
    listMilestones(eventId),
    fetchWallMedia(eventId, "photos", "photos"),
    fetchWallMedia(eventId, "videos", "videos"),
    listVideoEditorUploads(eventId),
  ]);

  const galleryClips: VideoEditorClip[] = galleryPhotos.map((p) => ({
    id: `gallery-${p.id}`,
    kind: "photo",
    source: "gallery",
    url: p.url,
    thumbnailUrl: null,
    label: p.caption,
    approved: true,
    createdAt: p.createdAt,
  }));

  const timelineClips: VideoEditorClip[] = milestones
    .filter((m) => m.imageUrl)
    .map((m) => ({
      id: `timeline-${m.id}`,
      kind: "photo",
      source: "timeline",
      url: m.imageUrl!,
      thumbnailUrl: null,
      label: m.title,
      approved: true,
      createdAt: m.createdAt,
    }));

  const wallPhotoClips: VideoEditorClip[] = wallPhotos.map((row) => ({
    id: `wall-photo-${row.id}`,
    kind: "photo",
    source: "memory-wall",
    url: publicMediaUrl("photos", row.storage_path),
    thumbnailUrl: null,
    label: row.caption,
    approved: row.approved,
    createdAt: row.created_at,
  }));

  const wallVideoClips: VideoEditorClip[] = wallVideos.map((row) => ({
    id: `wall-video-${row.id}`,
    kind: "video",
    source: "memory-wall",
    url: publicMediaUrl("videos", row.storage_path),
    thumbnailUrl: null,
    label: row.caption,
    approved: row.approved,
    createdAt: row.created_at,
  }));

  const uploadClips: VideoEditorClip[] = uploads.map((u) => ({
    id: `upload-${u.id}`,
    kind: "video",
    source: "upload",
    url: publicMediaUrl("videos", u.storagePath),
    thumbnailUrl: null,
    label: u.filename,
    approved: true,
    createdAt: u.createdAt,
  }));

  return [...uploadClips, ...wallVideoClips, ...wallPhotoClips, ...galleryClips, ...timelineClips].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

// ---------------------------------------------------------------------------
// video_editor_uploads — custom videos a client uploads specifically to edit
// with. Deliberately NOT the guest-facing videos table (see the migration's
// comment) — no approval/moderation lifecycle, never shown to guests.
// ---------------------------------------------------------------------------

export interface VideoEditorUpload {
  id: string;
  storagePath: string;
  filename: string | null;
  durationSeconds: number | null;
  createdAt: string;
}

export async function listVideoEditorUploads(eventId: string): Promise<VideoEditorUpload[]> {
  const { data, error } = await supabaseAdmin()
    .from("video_editor_uploads")
    .select("id, storage_path, filename, duration_seconds, created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("listVideoEditorUploads failed:", error.message);
    return [];
  }

  return (
    data as Array<{
      id: string;
      storage_path: string;
      filename: string | null;
      duration_seconds: number | null;
      created_at: string;
    }>
  ).map((row) => ({
    id: row.id,
    storagePath: row.storage_path,
    filename: row.filename,
    durationSeconds: row.duration_seconds,
    createdAt: row.created_at,
  }));
}

export async function confirmVideoEditorUpload(params: {
  eventId: string;
  adminId: string;
  storagePath: string;
  filename: string;
}): Promise<void> {
  const { error } = await supabaseAdmin().from("video_editor_uploads").insert({
    event_id: params.eventId,
    admin_id: params.adminId,
    storage_path: params.storagePath,
    filename: params.filename,
  });

  if (error) throw new Error(`Failed to save uploaded video: ${error.message}`);
}

export async function deleteVideoEditorUpload(eventId: string, uploadId: string): Promise<void> {
  const { data: row, error: lookupError } = await supabaseAdmin()
    .from("video_editor_uploads")
    .select("id, event_id, storage_path")
    .eq("id", uploadId)
    .maybeSingle<{ id: string; event_id: string; storage_path: string }>();

  if (lookupError) throw new Error(`Failed to look up upload: ${lookupError.message}`);
  if (!row || row.event_id !== eventId) throw new Error("That upload doesn't belong to this event.");

  await supabaseAdmin().storage.from("videos").remove([row.storage_path]);
  const { error: deleteError } = await supabaseAdmin().from("video_editor_uploads").delete().eq("id", uploadId);
  if (deleteError) throw new Error(`Failed to delete upload: ${deleteError.message}`);
}

// ---------------------------------------------------------------------------
// video_edit_jobs — saved edits (drafts + renders). See migration
// 0021_video_editor.sql for the full schema rationale (a client keeps
// several of these per event rather than one being silently overwritten,
// since renders cost real Shotstack credits).
// ---------------------------------------------------------------------------

export type VideoEditJobStatus = "draft" | "rendering" | "done" | "error";

export interface VideoEditJob {
  id: string;
  eventId: string;
  title: string;
  editJson: unknown | null;
  status: VideoEditJobStatus;
  resultUrl: string | null;
  errorMessage: string | null;
  isLiveOnBigScreen: boolean;
  createdAt: string;
  updatedAt: string;
}

interface VideoEditJobRow {
  id: string;
  event_id: string;
  title: string;
  edit_json: unknown | null;
  status: VideoEditJobStatus;
  result_path: string | null;
  error_message: string | null;
  is_live_on_big_screen: boolean;
  created_at: string;
  updated_at: string;
}

function mapJobRow(row: VideoEditJobRow): VideoEditJob {
  return {
    id: row.id,
    eventId: row.event_id,
    title: row.title,
    editJson: row.edit_json,
    status: row.status,
    resultUrl: row.result_path ? publicMediaUrl("gallery", row.result_path) : null,
    errorMessage: row.error_message,
    isLiveOnBigScreen: row.is_live_on_big_screen,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listVideoEditJobs(eventId: string): Promise<VideoEditJob[]> {
  const { data, error } = await supabaseAdmin()
    .from("video_edit_jobs")
    .select("*")
    .eq("event_id", eventId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`Failed to list video edits: ${error.message}`);
  return (data as VideoEditJobRow[]).map(mapJobRow);
}

/**
 * Creates or updates a draft — called on an interval while the client
 * works in the Studio SDK editor (see the autosave effect in
 * video-editor-workspace.tsx) so a closed tab never loses progress. A
 * job already in 'rendering'/'done'/'error' is never touched by
 * autosave; only drafts are overwritten in place.
 */
export async function saveVideoEditDraft(params: {
  jobId: string | null;
  eventId: string;
  adminId: string;
  title: string;
  editJson: unknown;
}): Promise<string> {
  if (params.jobId) {
    const { error } = await supabaseAdmin()
      .from("video_edit_jobs")
      .update({ title: params.title, edit_json: params.editJson, updated_at: new Date().toISOString() })
      .eq("id", params.jobId)
      .eq("status", "draft");
    if (error) throw new Error(`Failed to save draft: ${error.message}`);
    return params.jobId;
  }

  const { data, error } = await supabaseAdmin()
    .from("video_edit_jobs")
    .insert({
      event_id: params.eventId,
      admin_id: params.adminId,
      title: params.title,
      edit_json: params.editJson,
      status: "draft",
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) throw new Error(`Failed to create draft: ${error?.message}`);
  return data.id;
}

export async function getVideoEditJob(jobId: string): Promise<VideoEditJob | null> {
  const { data, error } = await supabaseAdmin().from("video_edit_jobs").select("*").eq("id", jobId).maybeSingle<VideoEditJobRow>();
  if (error) throw new Error(`Failed to load video edit: ${error.message}`);
  return data ? mapJobRow(data) : null;
}

/** Marks a draft job as queued for rendering — the actual Shotstack submission happens in the render-video-edit Edge Function (task #83). */
export async function markVideoEditJobRendering(jobId: string, shotstackRenderId: string | null): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("video_edit_jobs")
    .update({ status: "rendering", shotstack_render_id: shotstackRenderId, updated_at: new Date().toISOString() })
    .eq("id", jobId);
  if (error) throw new Error(`Failed to start render: ${error.message}`);
}

/**
 * Sets which completed job is showing on the Big Screen Display — at
 * most one per event (enforced by a partial unique index), so this
 * clears the flag on every other job for the event first. Copies
 * result_path into events.highlight_reel_path, the same field
 * /events/[slug]/display already reads, so that page needs zero
 * changes to pick this up.
 */
export async function setVideoEditJobLiveOnBigScreen(eventId: string, jobId: string): Promise<void> {
  const client = supabaseAdmin();

  const { data: job, error: lookupError } = await client
    .from("video_edit_jobs")
    .select("id, event_id, status, result_path")
    .eq("id", jobId)
    .maybeSingle<{ id: string; event_id: string; status: VideoEditJobStatus; result_path: string | null }>();

  if (lookupError) throw new Error(`Failed to look up video edit: ${lookupError.message}`);
  if (!job || job.event_id !== eventId) throw new Error("That video edit doesn't belong to this event.");
  if (job.status !== "done" || !job.result_path) throw new Error("Only a completed render can be set as the Big Screen video.");

  const { error: clearError } = await client
    .from("video_edit_jobs")
    .update({ is_live_on_big_screen: false })
    .eq("event_id", eventId)
    .eq("is_live_on_big_screen", true);
  if (clearError) throw new Error(`Failed to update Big Screen video: ${clearError.message}`);

  const { error: setError } = await client.from("video_edit_jobs").update({ is_live_on_big_screen: true }).eq("id", jobId);
  if (setError) throw new Error(`Failed to update Big Screen video: ${setError.message}`);

  const { error: eventError } = await client
    .from("events")
    .update({ highlight_reel_path: job.result_path })
    .eq("id", eventId);
  if (eventError) throw new Error(`Failed to update Big Screen video: ${eventError.message}`);
}

// ---------------------------------------------------------------------------
// Quota — mirrors services/slideshow-video-generations.ts exactly, just for
// this feature's own generations table + events.video_editor_generation_limit.
// ---------------------------------------------------------------------------

export async function countVideoEditGenerations(eventId: string): Promise<number> {
  const { count, error } = await supabaseAdmin()
    .from("video_edit_generations")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);

  if (error) throw new Error(`Failed to count video edit generations: ${error.message}`);
  return count ?? 0;
}

export async function recordVideoEditGeneration(eventId: string, adminId: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("video_edit_generations")
    .insert({ event_id: eventId, admin_id: adminId });
  if (error) throw new Error(`Failed to record video edit generation: ${error.message}`);
}

import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { publicMediaUrl } from "@/services/uploads";

/**
 * Creates a queued job row that the two Slideshow Video Edge Functions
 * (supabase/functions/generate-slideshow-video and
 * supabase/functions/slideshow-video-status) pick up by id and update as
 * the render progresses. Mirrors services/ai-image-jobs.ts's
 * createAiImageJob exactly — see the doc comment on
 * startSlideshowVideoAction in features/admin/slideshow/actions.ts for
 * the full flow.
 *
 * adminId is nullable for jobs created by the self-serve wizard
 * (features/start/actions/slideshow.ts), where the draft event has no
 * admin yet — see the nullable_admin_id_for_draft_jobs migration.
 */
export async function createSlideshowVideoJob(params: {
  eventId: string;
  adminId: string | null;
}): Promise<string> {
  const { data, error } = await supabaseAdmin()
    .from("slideshow_video_jobs")
    .insert({
      event_id: params.eventId,
      admin_id: params.adminId,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) throw new Error(`Failed to create slideshow video job: ${error?.message}`);
  return data.id;
}

/**
 * The most recently completed Slideshow Video render for an event, if
 * any — used to re-hydrate SlideshowComposer's preview panel on page
 * load/refresh. Same rationale as getLatestCompletedAiImageJob in
 * services/ai-image-jobs.ts: `videoUrl` in useSlideshowVideoJob was
 * purely in-memory, so a finished render disappeared from the preview
 * the moment the admin left the page or reloaded, even though the MP4
 * was still sitting in Storage.
 */
export async function getLatestCompletedSlideshowVideoJob(
  eventId: string,
): Promise<{ resultPath: string } | null> {
  const { data, error } = await supabaseAdmin()
    .from("slideshow_video_jobs")
    .select("result_path")
    .eq("event_id", eventId)
    .eq("status", "done")
    .not("result_path", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ result_path: string }>();

  if (error) {
    console.error("getLatestCompletedSlideshowVideoJob failed:", error.message);
    return null;
  }
  return data ? { resultPath: data.result_path } : null;
}

export interface CompletedSlideshowVideoJob {
  id: string;
  url: string;
  createdAt: string;
}

/** Every completed Slideshow Video render for an event, newest first — backs the Media Library's "Slideshow Videos" section. */
export async function listCompletedSlideshowVideoJobs(eventId: string): Promise<CompletedSlideshowVideoJob[]> {
  const { data, error } = await supabaseAdmin()
    .from("slideshow_video_jobs")
    .select("id, result_path, created_at")
    .eq("event_id", eventId)
    .eq("status", "done")
    .not("result_path", "is", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("listCompletedSlideshowVideoJobs failed:", error.message);
    return [];
  }

  return (data as Array<{ id: string; result_path: string; created_at: string }>).map((row) => ({
    id: row.id,
    url: publicMediaUrl("gallery", row.result_path),
    createdAt: row.created_at,
  }));
}

/** Looks up which event a Slideshow Video job belongs to, for the Media Library's auth check before delete — same pattern as getAiImageJobEventId (services/ai-image-jobs.ts). */
export async function getSlideshowVideoJobEventId(jobId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin()
    .from("slideshow_video_jobs")
    .select("event_id")
    .eq("id", jobId)
    .maybeSingle<{ event_id: string }>();
  if (error) {
    console.error("getSlideshowVideoJobEventId failed:", error.message);
    return null;
  }
  return data?.event_id ?? null;
}

/** Permanently removes a completed Slideshow Video render — Storage object plus row. Not part of the Recycle Bin (scoped to guest/gallery media tables only), so this is immediate and non-recoverable. */
export async function deleteSlideshowVideoJob(eventId: string, jobId: string): Promise<void> {
  const client = supabaseAdmin();
  const { data: job, error: lookupError } = await client
    .from("slideshow_video_jobs")
    .select("id, event_id, result_path")
    .eq("id", jobId)
    .maybeSingle<{ id: string; event_id: string; result_path: string | null }>();

  if (lookupError) throw new Error(`Failed to look up slideshow video: ${lookupError.message}`);
  if (!job || job.event_id !== eventId) throw new Error("That slideshow video doesn't belong to this event.");

  if (job.result_path) {
    await client.storage.from("gallery").remove([job.result_path]);
  }
  const { error: deleteError } = await client.from("slideshow_video_jobs").delete().eq("id", jobId);
  if (deleteError) throw new Error(`Failed to delete slideshow video: ${deleteError.message}`);
}

import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { publicMediaUrl } from "@/services/uploads";

/**
 * Creates a queued 'ai' job row that the two AI Timeline Movie Edge
 * Functions (supabase/functions/generate-timeline-movie and
 * supabase/functions/timeline-movie-status) pick up by id and update as
 * the render progresses. Mirrors services/slideshow-video-jobs.ts's
 * createSlideshowVideoJob — see startTimelineMovieAction in
 * features/admin/timeline-movie/actions.ts for the full flow.
 */
export async function createTimelineMovieJob(params: { eventId: string; adminId: string }): Promise<string> {
  const { data, error } = await supabaseAdmin()
    .from("timeline_movie_jobs")
    .insert({ event_id: params.eventId, admin_id: params.adminId, source: "ai" })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) throw new Error(`Failed to create timeline movie job: ${error?.message}`);
  return data.id;
}

/**
 * A completed 'done' job row for an admin-uploaded video (skips HeyGen
 * entirely) — see requestTimelineMovieUploadUrlAction/
 * confirmTimelineMovieUploadAction. Doesn't touch
 * timeline_movie_generations (that's the AI-quota counter only).
 */
export async function createUploadedTimelineMovieJob(params: {
  eventId: string;
  adminId: string;
  storagePath: string;
}): Promise<string> {
  const { data, error } = await supabaseAdmin()
    .from("timeline_movie_jobs")
    .insert({
      event_id: params.eventId,
      admin_id: params.adminId,
      source: "upload",
      status: "done",
      result_path: params.storagePath,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) throw new Error(`Failed to save uploaded timeline movie: ${error?.message}`);
  return data.id;
}

/**
 * The most recently completed Timeline Movie (AI-rendered or uploaded)
 * for an event, if any — used to re-hydrate the composer's preview
 * panel on page load/refresh, same rationale as
 * getLatestCompletedSlideshowVideoJob.
 */
export async function getLatestCompletedTimelineMovieJob(eventId: string): Promise<{ resultPath: string } | null> {
  const { data, error } = await supabaseAdmin()
    .from("timeline_movie_jobs")
    .select("result_path")
    .eq("event_id", eventId)
    .eq("status", "done")
    .not("result_path", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ result_path: string }>();

  if (error) {
    console.error("getLatestCompletedTimelineMovieJob failed:", error.message);
    return null;
  }
  return data ? { resultPath: data.result_path } : null;
}

export interface CompletedTimelineMovieJob {
  id: string;
  url: string;
  createdAt: string;
}

/** Every completed Timeline Movie for an event, newest first — backs the Media Library's "Timeline Movies" section. */
export async function listCompletedTimelineMovieJobs(eventId: string): Promise<CompletedTimelineMovieJob[]> {
  const { data, error } = await supabaseAdmin()
    .from("timeline_movie_jobs")
    .select("id, result_path, created_at")
    .eq("event_id", eventId)
    .eq("status", "done")
    .not("result_path", "is", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("listCompletedTimelineMovieJobs failed:", error.message);
    return [];
  }

  return (data as Array<{ id: string; result_path: string; created_at: string }>).map((row) => ({
    id: row.id,
    url: publicMediaUrl("videos", row.result_path),
    createdAt: row.created_at,
  }));
}

/** Looks up which event a Timeline Movie job belongs to, for the Media Library's auth check before delete — same pattern as getSlideshowVideoJobEventId. */
export async function getTimelineMovieJobEventId(jobId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin()
    .from("timeline_movie_jobs")
    .select("event_id")
    .eq("id", jobId)
    .maybeSingle<{ event_id: string }>();
  if (error) {
    console.error("getTimelineMovieJobEventId failed:", error.message);
    return null;
  }
  return data?.event_id ?? null;
}

/** Permanently removes a completed Timeline Movie — Storage object plus row. Not part of the Recycle Bin, so this is immediate and non-recoverable. */
export async function deleteTimelineMovieJob(eventId: string, jobId: string): Promise<void> {
  const client = supabaseAdmin();
  const { data: job, error: lookupError } = await client
    .from("timeline_movie_jobs")
    .select("id, event_id, result_path")
    .eq("id", jobId)
    .maybeSingle<{ id: string; event_id: string; result_path: string | null }>();

  if (lookupError) throw new Error(`Failed to look up timeline movie: ${lookupError.message}`);
  if (!job || job.event_id !== eventId) throw new Error("That timeline movie doesn't belong to this event.");

  if (job.result_path) {
    await client.storage.from("videos").remove([job.result_path]);
  }
  const { error: deleteError } = await client.from("timeline_movie_jobs").delete().eq("id", jobId);
  if (deleteError) throw new Error(`Failed to delete timeline movie: ${deleteError.message}`);
}

import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

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

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
 */
export async function createSlideshowVideoJob(params: {
  eventId: string;
  adminId: string;
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

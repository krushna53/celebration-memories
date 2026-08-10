import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

/** Total completed AI (HeyGen) Timeline Movie renders recorded for an event (all admins combined). Uploads don't count — see timeline_movie_jobs.source. */
export async function countTimelineMovieGenerations(eventId: string): Promise<number> {
  const { count, error } = await supabaseAdmin()
    .from("timeline_movie_generations")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);

  if (error) {
    console.error("countTimelineMovieGenerations failed:", error.message);
    return 0;
  }
  return count ?? 0;
}

/**
 * Not called from Next.js — the timeline-movie-status Edge Function
 * does this insert itself, inline, once a render finishes successfully
 * (Deno can't import this server-only Next.js module). Kept here as the
 * documented, mirrored equivalent, same as
 * slideshow-video-generations.ts's recordSlideshowVideoGeneration.
 */
export async function recordTimelineMovieGeneration(params: { eventId: string; adminId: string }): Promise<void> {
  const { error } = await supabaseAdmin().from("timeline_movie_generations").insert({
    event_id: params.eventId,
    admin_id: params.adminId,
  });

  if (error) {
    console.error("recordTimelineMovieGeneration failed:", error.message);
  }
}

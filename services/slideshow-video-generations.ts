import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

/** Total completed Slideshow Video renders recorded for an event (all admins combined). */
export async function countSlideshowVideoGenerations(eventId: string): Promise<number> {
  const { count, error } = await supabaseAdmin()
    .from("slideshow_video_generations")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);

  if (error) {
    console.error("countSlideshowVideoGenerations failed:", error.message);
    return 0;
  }
  return count ?? 0;
}

/**
 * Not called from Next.js — the slideshow-video-status Edge Function
 * does this insert itself, inline, once a render finishes successfully
 * (Deno can't import this server-only Next.js module). Kept here as the
 * documented, mirrored equivalent, same as
 * ai-image-generations.ts's recordAiImageGeneration.
 */
export async function recordSlideshowVideoGeneration(params: {
  eventId: string;
  adminId: string;
}): Promise<void> {
  const { error } = await supabaseAdmin().from("slideshow_video_generations").insert({
    event_id: params.eventId,
    admin_id: params.adminId,
  });

  if (error) {
    console.error("recordSlideshowVideoGeneration failed:", error.message);
  }
}

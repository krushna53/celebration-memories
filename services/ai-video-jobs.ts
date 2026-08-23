import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { publicMediaUrl } from "@/services/uploads";

export async function createAiVideoJob(params: { eventId: string; adminId: string; prompt: string }): Promise<string> {
  const { data, error } = await supabaseAdmin()
    .from("ai_video_jobs")
    .insert({ event_id: params.eventId, admin_id: params.adminId, prompt: params.prompt.slice(0, 2000) })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) throw new Error(`Failed to create AI video job: ${error?.message}`);
  return data.id;
}

export async function getLatestCompletedAiVideoJob(eventId: string): Promise<{ resultPath: string } | null> {
  const { data, error } = await supabaseAdmin()
    .from("ai_video_jobs")
    .select("result_path")
    .eq("event_id", eventId)
    .eq("status", "done")
    .not("result_path", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ result_path: string }>();
  if (error) {
    console.error("getLatestCompletedAiVideoJob failed:", error.message);
    return null;
  }
  return data ? { resultPath: data.result_path } : null;
}

export async function countAiVideoGenerations(eventId: string): Promise<number> {
  const { count, error } = await supabaseAdmin()
    .from("ai_video_generations")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);
  if (error) {
    console.error("countAiVideoGenerations failed:", error.message);
    return 0;
  }
  return count ?? 0;
}

export async function getAiVideoUrl(eventId: string): Promise<string | null> {
  const job = await getLatestCompletedAiVideoJob(eventId);
  return job ? publicMediaUrl("gallery", job.resultPath) : null;
}

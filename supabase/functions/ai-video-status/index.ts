import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import OpenAI from "npm:openai@6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return respond({ success: false, error: "Method not allowed" }, 405);
  let body: { jobId?: string };
  try { body = await req.json(); } catch { return respond({ success: false, error: "Invalid request body" }, 400); }
  if (!body.jobId) return respond({ success: false, error: "Missing jobId" }, 400);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!url || !serviceKey || !openaiKey) return respond({ success: false, error: "Not configured" }, 500);
  const supabase = createClient(url, serviceKey);
  const { data: job, error } = await supabase
    .from("ai_video_jobs")
    .select("status, event_id, admin_id, openai_video_id, result_path, error_message")
    .eq("id", body.jobId)
    .maybeSingle<{ status: string; event_id: string; admin_id: string; openai_video_id: string | null; result_path: string | null; error_message: string | null }>();
  if (error || !job) return respond({ success: false, error: "Job not found" }, 404);
  if (job.status === "done" && job.result_path) {
    const { data } = supabase.storage.from("gallery").getPublicUrl(job.result_path);
    return respond({ success: true, status: "done", resultUrl: data.publicUrl });
  }
  if (job.status === "error") return respond({ success: true, status: "error", error: job.error_message || "Generation failed." });
  if (!job.openai_video_id) return respond({ success: true, status: "processing" });

  try {
    const openai = new OpenAI({ apiKey: openaiKey });
    const video = await openai.videos.retrieve(job.openai_video_id);
    if (video.status === "failed") {
      const message = video.error?.message || "OpenAI could not generate this video.";
      await supabase.from("ai_video_jobs").update({ status: "error", error_message: message.slice(0, 2000), updated_at: new Date().toISOString() }).eq("id", body.jobId);
      return respond({ success: true, status: "error", error: message });
    }
    if (video.status !== "completed") return respond({ success: true, status: "processing", progress: video.progress });

    const content = await openai.videos.downloadContent(job.openai_video_id);
    const path = `${job.event_id}/ai-video/${crypto.randomUUID()}.mp4`;
    const { error: uploadError } = await supabase.storage.from("gallery").upload(path, new Uint8Array(await content.arrayBuffer()), { contentType: "video/mp4", upsert: false });
    if (uploadError) throw new Error(`Failed to save generated video: ${uploadError.message}`);
    await supabase.from("ai_video_jobs").update({ status: "done", result_path: path, updated_at: new Date().toISOString() }).eq("id", body.jobId);
    await supabase.from("ai_video_generations").insert({ event_id: job.event_id, admin_id: job.admin_id });
    const { data } = supabase.storage.from("gallery").getPublicUrl(path);
    return respond({ success: true, status: "done", resultUrl: data.publicUrl });
  } catch {
    return respond({ success: true, status: "processing" });
  }
});

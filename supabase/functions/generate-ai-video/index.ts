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

  let body: { jobId?: string; eventId?: string };
  try { body = await req.json(); } catch { return respond({ success: false, error: "Invalid request body" }, 400); }
  if (!body.jobId || !body.eventId) return respond({ success: false, error: "Missing jobId or eventId" }, 400);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!url || !serviceKey || !openaiKey) return respond({ success: false, error: "Not configured" }, 500);
  const supabase = createClient(url, serviceKey);
  const { data: job, error } = await supabase
    .from("ai_video_jobs")
    .select("status, event_id, prompt")
    .eq("id", body.jobId)
    .maybeSingle<{ status: string; event_id: string; prompt: string }>();
  if (error || !job) return respond({ success: false, error: "Job not found" }, 404);
  if (job.event_id !== body.eventId || job.status !== "queued") return respond({ success: false, error: "Job already submitted or mismatched" }, 409);

  try {
    const video = await new OpenAI({ apiKey: openaiKey }).videos.create({
      model: Deno.env.get("OPENAI_VIDEO_MODEL") === "sora-2-pro" ? "sora-2-pro" : "sora-2",
      prompt: job.prompt,
      seconds: "4",
      size: "720x1280",
    });
    await supabase.from("ai_video_jobs").update({ status: "processing", openai_video_id: video.id, updated_at: new Date().toISOString() }).eq("id", body.jobId);
    return respond({ success: true, videoId: video.id }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : "OpenAI video creation failed.";
    await supabase.from("ai_video_jobs").update({ status: "error", error_message: message.slice(0, 2000), updated_at: new Date().toISOString() }).eq("id", body.jobId);
    return respond({ success: false, error: message }, 502);
  }
});

// Supabase Edge Function — polled by the browser every few seconds after
// render-video-edit submits a render. Same shape as
// slideshow-video-status/index.ts (see that file's comment for the full
// two-function async-render rationale) — checks Shotstack's render
// status, and once done, downloads the finished MP4 and re-uploads it
// into our own Storage (gallery bucket, video-editor/ prefix) so the
// result doesn't depend on Shotstack's own retention, then marks the
// video_edit_jobs row done and records a completed generation for the
// per-event quota (video_edit_generations).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

interface RequestBody {
  jobId: string;
}

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ success: false, error: "Invalid request body" }, 400);
  }

  const { jobId } = body;
  if (!jobId) {
    return jsonResponse({ success: false, error: "Missing jobId" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const shotstackKey = Deno.env.get("SHOTSTACK_API_KEY");
  const shotstackEnv = Deno.env.get("SHOTSTACK_ENV") || "v1";

  if (!supabaseUrl || !serviceRoleKey || !shotstackKey) {
    console.error("video-edit-status: missing required environment variables");
    return jsonResponse({ success: false, error: "Not configured" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: job, error: lookupError } = await supabase
    .from("video_edit_jobs")
    .select("status, event_id, admin_id, shotstack_render_id, result_path, error_message")
    .eq("id", jobId)
    .maybeSingle<{
      status: string;
      event_id: string;
      admin_id: string;
      shotstack_render_id: string | null;
      result_path: string | null;
      error_message: string | null;
    }>();

  if (lookupError) {
    console.error(`video-edit-status: lookup failed for job ${jobId}:`, lookupError.message);
    return jsonResponse({ success: false, error: "Lookup failed" }, 500);
  }
  if (!job) {
    return jsonResponse({ success: false, error: "Job not found" }, 404);
  }

  if (job.status === "done" && job.result_path) {
    const { data: pub } = supabase.storage.from("gallery").getPublicUrl(job.result_path);
    return jsonResponse({ success: true, status: "done", resultPath: job.result_path, resultUrl: pub.publicUrl }, 200);
  }
  if (job.status === "error") {
    return jsonResponse({ success: true, status: "error", error: job.error_message || "Render failed." }, 200);
  }
  if (!job.shotstack_render_id) {
    return jsonResponse({ success: true, status: "processing" }, 200);
  }

  let shotstackStatus: string;
  let shotstackUrl: string | null = null;
  try {
    const res = await fetch(`https://api.shotstack.io/edit/${shotstackEnv}/render/${job.shotstack_render_id}`, {
      headers: { "x-api-key": shotstackKey },
    });
    const payload = await res.json();
    if (!res.ok || !payload?.response) {
      const message = payload?.message || `Shotstack returned ${res.status}`;
      throw new Error(message);
    }
    shotstackStatus = payload.response.status;
    shotstackUrl = payload.response.url ?? null;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error checking render status.";
    console.error(`video-edit-status: status check failed for job ${jobId}: ${message}`);
    return jsonResponse({ success: true, status: "processing" }, 200);
  }

  if (shotstackStatus === "failed") {
    const message = "Shotstack failed to render this video.";
    await supabase
      .from("video_edit_jobs")
      .update({ status: "error", error_message: message, updated_at: new Date().toISOString() })
      .eq("id", jobId);
    return jsonResponse({ success: true, status: "error", error: message }, 200);
  }

  if (shotstackStatus !== "done" || !shotstackUrl) {
    return jsonResponse({ success: true, status: "processing" }, 200);
  }

  try {
    const videoRes = await fetch(shotstackUrl);
    if (!videoRes.ok) throw new Error(`Failed to download rendered video (${videoRes.status})`);
    const bytes = new Uint8Array(await videoRes.arrayBuffer());
    const path = `${job.event_id}/video-editor/${crypto.randomUUID()}.mp4`;

    const { error: uploadError } = await supabase.storage
      .from("gallery")
      .upload(path, bytes, { contentType: "video/mp4", upsert: false });
    if (uploadError) throw new Error(`Failed to save rendered video: ${uploadError.message}`);

    await supabase
      .from("video_edit_jobs")
      .update({ status: "done", result_path: path, updated_at: new Date().toISOString() })
      .eq("id", jobId);

    await supabase.from("video_edit_generations").insert({
      event_id: job.event_id,
      admin_id: job.admin_id,
    });

    const { data: pub } = supabase.storage.from("gallery").getPublicUrl(path);
    return jsonResponse({ success: true, status: "done", resultPath: path, resultUrl: pub.publicUrl }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error saving the rendered video.";
    console.error(`video-edit-status: finalize failed for job ${jobId}: ${message}`);
    await supabase
      .from("video_edit_jobs")
      .update({ status: "error", error_message: message.slice(0, 2000), updated_at: new Date().toISOString() })
      .eq("id", jobId);
    return jsonResponse({ success: true, status: "error", error: message }, 200);
  }
});

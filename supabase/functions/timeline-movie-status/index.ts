// Supabase Edge Function — polled by the browser every few seconds
// after generate-timeline-movie submits a render. Checks HeyGen's video
// status; once it reports "completed", downloads the finished MP4
// (HeyGen's video_url expires in 7 days) and re-uploads it into our own
// Storage (videos bucket, timeline-movie/ prefix), then marks the job
// row done and records a completed generation for the per-event quota.
//
// See generate-timeline-movie/index.ts for the "start" half of this
// flow and the README's "AI Timeline Movie" section for the full
// design. Mirrors slideshow-video-status/index.ts's structure closely.

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
  const heygenKey = Deno.env.get("HEYGEN_API_KEY");

  if (!supabaseUrl || !serviceRoleKey || !heygenKey) {
    console.error("timeline-movie-status: missing required environment variables");
    return jsonResponse({ success: false, error: "Not configured" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: job, error: lookupError } = await supabase
    .from("timeline_movie_jobs")
    .select("status, event_id, admin_id, heygen_video_id, result_path, error_message")
    .eq("id", jobId)
    .maybeSingle<{
      status: string;
      event_id: string;
      admin_id: string;
      heygen_video_id: string | null;
      result_path: string | null;
      error_message: string | null;
    }>();

  if (lookupError) {
    console.error(`timeline-movie-status: lookup failed for job ${jobId}:`, lookupError.message);
    return jsonResponse({ success: false, error: "Lookup failed" }, 500);
  }
  if (!job) {
    return jsonResponse({ success: false, error: "Job not found" }, 404);
  }

  // Already finished (from an earlier poll) — return the cached result
  // instead of hitting HeyGen again.
  if (job.status === "done" && job.result_path) {
    const { data: pub } = supabase.storage.from("videos").getPublicUrl(job.result_path);
    return jsonResponse({ success: true, status: "done", resultPath: job.result_path, resultUrl: pub.publicUrl }, 200);
  }
  if (job.status === "error") {
    return jsonResponse({ success: true, status: "error", error: job.error_message || "Render failed." }, 200);
  }
  if (!job.heygen_video_id) {
    return jsonResponse({ success: true, status: "processing" }, 200);
  }

  let heygenStatus: string;
  let heygenUrl: string | null = null;
  let heygenError: string | null = null;
  try {
    const res = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${job.heygen_video_id}`, {
      headers: { "X-Api-Key": heygenKey },
    });
    const payload = await res.json();
    if (!res.ok || !payload?.data) {
      const message = payload?.message || `HeyGen returned ${res.status}`;
      throw new Error(message);
    }
    heygenStatus = payload.data.status;
    heygenUrl = payload.data.video_url ?? null;
    heygenError = payload.data.error?.detail || payload.data.error?.message || null;
  } catch (err) {
    // A transient error checking status shouldn't fail the whole job —
    // the browser will just poll again shortly.
    const message = err instanceof Error ? err.message : "Unknown error checking render status.";
    console.error(`timeline-movie-status: status check failed for job ${jobId}: ${message}`);
    return jsonResponse({ success: true, status: "processing" }, 200);
  }

  if (heygenStatus === "failed") {
    const message = heygenError || "HeyGen failed to render this video.";
    await supabase
      .from("timeline_movie_jobs")
      .update({ status: "error", error_message: message.slice(0, 2000), updated_at: new Date().toISOString() })
      .eq("id", jobId);
    return jsonResponse({ success: true, status: "error", error: message }, 200);
  }

  if (heygenStatus !== "completed" || !heygenUrl) {
    // pending, processing/waiting, ... — still in progress.
    return jsonResponse({ success: true, status: "processing" }, 200);
  }

  // Done on HeyGen's side — pull the finished MP4 down and store our own
  // copy so the result doesn't depend on HeyGen's 7-day URL expiry.
  try {
    const videoRes = await fetch(heygenUrl);
    if (!videoRes.ok) throw new Error(`Failed to download rendered video (${videoRes.status})`);
    const bytes = new Uint8Array(await videoRes.arrayBuffer());
    const path = `${job.event_id}/timeline-movie/${crypto.randomUUID()}.mp4`;

    const { error: uploadError } = await supabase.storage
      .from("videos")
      .upload(path, bytes, { contentType: "video/mp4", upsert: false });
    if (uploadError) throw new Error(`Failed to save rendered video: ${uploadError.message}`);

    await supabase
      .from("timeline_movie_jobs")
      .update({ status: "done", result_path: path, updated_at: new Date().toISOString() })
      .eq("id", jobId);

    await supabase.from("timeline_movie_generations").insert({
      event_id: job.event_id,
      admin_id: job.admin_id,
    });

    const { data: pub } = supabase.storage.from("videos").getPublicUrl(path);
    return jsonResponse({ success: true, status: "done", resultPath: path, resultUrl: pub.publicUrl }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error saving the rendered video.";
    console.error(`timeline-movie-status: finalize failed for job ${jobId}: ${message}`);
    await supabase
      .from("timeline_movie_jobs")
      .update({ status: "error", error_message: message.slice(0, 2000), updated_at: new Date().toISOString() })
      .eq("id", jobId);
    return jsonResponse({ success: true, status: "error", error: message }, 200);
  }
});

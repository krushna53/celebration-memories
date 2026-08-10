// Supabase Edge Function — submits an AI Timeline Movie render request
// to HeyGen (https://heygen.com), an AI avatar video API.
//
// "Start" half of a two-function, poll-based flow — see
// supabase/functions/timeline-movie-status/index.ts for the other half,
// and the README's "AI Timeline Movie" section for the full design
// (in short: HeyGen's video.generate is asynchronous, same as
// Shotstack's render — this function only submits the render and
// returns HeyGen's video id; the browser then polls
// timeline-movie-status until it's done). Mirrors
// generate-slideshow-video/index.ts's structure closely.
//
// The `timeline_movie_jobs` row is created up front by the Next.js
// Server Action (startTimelineMovieAction in
// features/admin/timeline-movie/actions.ts) — that's where the
// per-event quota check for client-role admins happens. This function
// picks up that job by id, builds the HeyGen video_inputs (one "scene"
// per selected Timeline milestone: the AI avatar narrates that
// milestone's title/description, with a matching photo as the scene's
// background image), submits it, and records the resulting HeyGen
// video id on the job row.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

interface SceneInput {
  /** Narration script for this scene — built server-side (Next.js) from the milestone's period/title/description. */
  script: string;
  /** A public image URL to use as this scene's background, if any. */
  backgroundUrl: string | null;
}

interface RequestBody {
  jobId: string;
  eventId: string;
  scenes: SceneInput[];
  avatarId: string;
  voiceId: string;
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

// HeyGen's video_inputs array must contain between 1 and 50 items — capped
// well below that here to keep a single render's cost/render-time bounded
// (each scene is real narrated seconds, billed per second by HeyGen).
const MAX_SCENES = 20;

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

  const { jobId, eventId, scenes, avatarId, voiceId } = body;
  if (!jobId || !eventId || !Array.isArray(scenes) || scenes.length === 0 || !avatarId || !voiceId) {
    return jsonResponse({ success: false, error: "Missing jobId, eventId, scenes, avatarId, or voiceId" }, 400);
  }
  if (scenes.length > MAX_SCENES) {
    return jsonResponse({ success: false, error: `Too many scenes — pick at most ${MAX_SCENES} Timeline entries.` }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const heygenKey = Deno.env.get("HEYGEN_API_KEY");

  if (!supabaseUrl || !serviceRoleKey || !heygenKey) {
    console.error("generate-timeline-movie: missing required environment variables");
    return jsonResponse({ success: false, error: "Not configured" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: job, error: lookupError } = await supabase
    .from("timeline_movie_jobs")
    .select("status, event_id")
    .eq("id", jobId)
    .maybeSingle<{ status: string; event_id: string }>();

  if (lookupError) {
    console.error(`generate-timeline-movie: lookup failed for job ${jobId}:`, lookupError.message);
    return jsonResponse({ success: false, error: "Lookup failed" }, 500);
  }
  if (!job) {
    return jsonResponse({ success: false, error: "Job not found" }, 404);
  }
  if (job.event_id !== eventId) {
    return jsonResponse({ success: false, error: "Job/event mismatch" }, 400);
  }
  if (job.status !== "queued") {
    return jsonResponse({ success: false, error: "Job already submitted" }, 409);
  }

  async function fail(message: string) {
    console.error(`generate-timeline-movie: job ${jobId} failed: ${message}`);
    await supabase
      .from("timeline_movie_jobs")
      .update({ status: "error", error_message: message.slice(0, 2000), updated_at: new Date().toISOString() })
      .eq("id", jobId);
    return jsonResponse({ success: false, error: message }, 502);
  }

  const videoInputs = scenes.map((scene) => ({
    character: {
      type: "avatar",
      avatar_id: avatarId,
      avatar_style: "normal",
    },
    voice: {
      type: "text",
      input_text: scene.script.slice(0, 1500),
      voice_id: voiceId,
    },
    background: scene.backgroundUrl
      ? { type: "image", url: scene.backgroundUrl, fit: "cover" }
      : { type: "color", value: "#0a1128" },
  }));

  let heygenVideoId: string;
  try {
    const res = await fetch("https://api.heygen.com/v2/video/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": heygenKey },
      body: JSON.stringify({
        video_inputs: videoInputs,
        title: "Timeline Movie",
        dimension: { width: 1280, height: 720 },
        caption: true,
      }),
    });
    const payload = await res.json();
    const videoId = payload?.data?.video_id;
    if (!res.ok || !videoId) {
      const message = payload?.message || payload?.error?.message || `HeyGen returned ${res.status}`;
      return await fail(`HeyGen rejected the render request: ${message}`);
    }
    heygenVideoId = videoId;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error contacting HeyGen.";
    return await fail(`Failed to submit render to HeyGen: ${message}`);
  }

  await supabase
    .from("timeline_movie_jobs")
    .update({ status: "rendering", heygen_video_id: heygenVideoId, updated_at: new Date().toISOString() })
    .eq("id", jobId);

  return jsonResponse({ success: true, jobId, heygenVideoId }, 200);
});

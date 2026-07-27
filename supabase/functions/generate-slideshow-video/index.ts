// Supabase Edge Function — submits a Slideshow Video render request to
// Shotstack (https://shotstack.io), an external video-editing API.
//
// This is the "start" half of a two-function, poll-based flow — see
// supabase/functions/slideshow-video-status/index.ts for the other half,
// and the README's "Slideshow Video" section for the full design
// rationale (in short: Shotstack renders are asynchronous, so unlike
// AI Image this can't be a single synchronous request/response — this
// function only submits the render and returns Shotstack's render id;
// the browser then polls slideshow-video-status until it's done).
//
// The `slideshow_video_jobs` row is created up front by the Next.js
// Server Action (startSlideshowVideoAction in
// features/admin/slideshow/actions.ts) — that's where the per-event
// quota check for client-role admins happens. This function picks up
// that job by id, builds the Shotstack JSON timeline from the photos/
// captions/audio the browser sends, submits it, and records the
// resulting Shotstack render id on the job row.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

interface SlideInput {
  url: string;
  captionTitle: string | null;
  captionSubtitle: string | null;
}

interface RequestBody {
  jobId: string;
  eventId: string;
  slides: SlideInput[];
  secondsPerPhoto: number;
  audioUrl: string | null;
  showCaptions: boolean;
  theme: {
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
  };
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

/** Minimal HTML-escaping for admin-entered timeline text before it's interpolated into Shotstack's `html` asset field. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** "#c9a227" -> "rgba(201,162,39,alpha)" — Shotstack's HTML asset `background` accepts rgba() for a translucent caption bar. */
function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const WIDTH = 1280;
const HEIGHT = 720;
const EFFECTS = ["zoomIn", "slideLeft", "slideRight", "zoomOut", "slideUp", "slideDown"];

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

  const { jobId, eventId, slides, secondsPerPhoto, audioUrl, showCaptions, theme } = body;
  if (!jobId || !eventId || !Array.isArray(slides) || slides.length === 0) {
    return jsonResponse({ success: false, error: "Missing jobId, eventId, or slides" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const shotstackKey = Deno.env.get("SHOTSTACK_API_KEY");
  // "v1" (production, no watermark) by default. Set to "stage" while
  // testing with a free sandbox API key — see the README for how to get
  // one and which key goes with which environment.
  const shotstackEnv = Deno.env.get("SHOTSTACK_ENV") || "v1";

  if (!supabaseUrl || !serviceRoleKey || !shotstackKey) {
    console.error("generate-slideshow-video: missing required environment variables");
    return jsonResponse({ success: false, error: "Not configured" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: job, error: lookupError } = await supabase
    .from("slideshow_video_jobs")
    .select("status, event_id")
    .eq("id", jobId)
    .maybeSingle<{ status: string; event_id: string }>();

  if (lookupError) {
    console.error(`generate-slideshow-video: lookup failed for job ${jobId}:`, lookupError.message);
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
    console.error(`generate-slideshow-video: job ${jobId} failed: ${message}`);
    await supabase
      .from("slideshow_video_jobs")
      .update({ status: "error", error_message: message.slice(0, 2000), updated_at: new Date().toISOString() })
      .eq("id", jobId);
    return jsonResponse({ success: false, error: message }, 502);
  }

  // Each clip starts slightly before the previous one ends so the fade
  // transitions actually crossfade rather than cut — same timing trick
  // Shotstack's own image-slideshow example uses.
  const seconds = Math.max(1, secondsPerPhoto || 3);
  const overlap = Math.min(1, seconds / 3);

  const imageClips = slides.map((slide, i) => ({
    asset: { type: "image", src: slide.url },
    start: Number((i * (seconds - overlap)).toFixed(2)),
    length: seconds,
    effect: EFFECTS[i % EFFECTS.length],
    transition: { in: "fade", out: "fade" },
  }));

  const captionClips = showCaptions
    ? slides
        .map((slide, i) => {
          if (!slide.captionTitle) return null;
          const html = [
            `<p class="title">${escapeHtml(slide.captionTitle)}</p>`,
            slide.captionSubtitle ? `<p class="sub">${escapeHtml(slide.captionSubtitle)}</p>` : "",
          ].join("");
          const css = [
            `.title{font-family:'${theme.fontFamily}',serif;color:${theme.primaryColor};font-size:34px;font-weight:600;margin:0;}`,
            `.sub{font-family:'${theme.fontFamily}',serif;color:#ffffff;font-size:19px;font-weight:400;margin:4px 0 0;opacity:0.9;}`,
          ].join(" ");
          const clipStart = Number((i * (seconds - overlap)).toFixed(2));
          return {
            asset: {
              type: "html",
              html,
              css,
              width: WIDTH,
              height: 160,
              background: hexToRgba(theme.secondaryColor, 0.55),
              position: "bottom",
            },
            start: clipStart,
            length: seconds,
            position: "bottom",
            offset: { y: 0.04 },
          };
        })
        .filter((c): c is NonNullable<typeof c> => c !== null)
    : [];

  const tracks: unknown[] = [];
  if (captionClips.length > 0) tracks.push({ clips: captionClips });
  tracks.push({ clips: imageClips });

  const timeline: Record<string, unknown> = { tracks };
  if (audioUrl) {
    timeline.soundtrack = { src: audioUrl, effect: "fadeInFadeOut" };
  }

  const edit = {
    timeline,
    output: { format: "mp4", size: { width: WIDTH, height: HEIGHT } },
  };

  let shotstackId: string;
  try {
    const res = await fetch(`https://api.shotstack.io/edit/${shotstackEnv}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": shotstackKey },
      body: JSON.stringify(edit),
    });
    const payload = await res.json();
    if (!res.ok || !payload?.response?.id) {
      const message = payload?.message || payload?.response?.message || `Shotstack returned ${res.status}`;
      return await fail(`Shotstack rejected the render request: ${message}`);
    }
    shotstackId = payload.response.id;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error contacting Shotstack.";
    return await fail(`Failed to submit render to Shotstack: ${message}`);
  }

  await supabase
    .from("slideshow_video_jobs")
    .update({ status: "rendering", shotstack_render_id: shotstackId, updated_at: new Date().toISOString() })
    .eq("id", jobId);

  return jsonResponse({ success: true, jobId, shotstackRenderId: shotstackId }, 200);
});

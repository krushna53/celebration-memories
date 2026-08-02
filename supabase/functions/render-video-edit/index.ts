// Supabase Edge Function — submits a Video Editor render request to
// Shotstack (https://shotstack.io).
//
// Unlike generate-slideshow-video (which builds the Shotstack JSON
// timeline itself from photos/captions), this function is a thin
// pass-through: the @shotstack/shotstack-studio SDK running in the
// browser (features/admin/video-editor/video-editor-workspace.tsx)
// already builds a complete, valid Edit JSON document as the client
// edits (edit.getEdit()) — that's exactly the same JSON schema the
// Shotstack Edit API renders directly, so this function just needs to
// forward it, not reconstruct it.
//
// Same two-function, poll-based flow as Slideshow Video (Shotstack
// renders are async) — see video-edit-status/index.ts for the other
// half. The `video_edit_jobs` row already exists (created by
// saveVideoEditDraftAction as the client's draft is autosaved); this
// function only flips it from 'draft' to 'rendering' and records
// Shotstack's render id.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

interface RequestBody {
  jobId: string;
  eventId: string;
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

  const { jobId, eventId } = body;
  if (!jobId || !eventId) {
    return jsonResponse({ success: false, error: "Missing jobId or eventId" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const shotstackKey = Deno.env.get("SHOTSTACK_API_KEY");
  const shotstackEnv = Deno.env.get("SHOTSTACK_ENV") || "v1";

  if (!supabaseUrl || !serviceRoleKey || !shotstackKey) {
    console.error("render-video-edit: missing required environment variables");
    return jsonResponse({ success: false, error: "Not configured" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: job, error: lookupError } = await supabase
    .from("video_edit_jobs")
    .select("status, event_id, edit_json")
    .eq("id", jobId)
    .maybeSingle<{ status: string; event_id: string; edit_json: unknown }>();

  if (lookupError) {
    console.error(`render-video-edit: lookup failed for job ${jobId}:`, lookupError.message);
    return jsonResponse({ success: false, error: "Lookup failed" }, 500);
  }
  if (!job) {
    return jsonResponse({ success: false, error: "Job not found" }, 404);
  }
  if (job.event_id !== eventId) {
    return jsonResponse({ success: false, error: "Job/event mismatch" }, 400);
  }
  if (job.status !== "draft") {
    return jsonResponse({ success: false, error: "This edit has already been submitted for rendering." }, 409);
  }
  if (!job.edit_json) {
    return jsonResponse({ success: false, error: "Nothing to render yet — add at least one clip first." }, 400);
  }

  async function fail(message: string) {
    console.error(`render-video-edit: job ${jobId} failed: ${message}`);
    await supabase
      .from("video_edit_jobs")
      .update({ status: "error", error_message: message.slice(0, 2000), updated_at: new Date().toISOString() })
      .eq("id", jobId);
    return jsonResponse({ success: false, error: message }, 502);
  }

  let shotstackId: string;
  try {
    const res = await fetch(`https://api.shotstack.io/edit/${shotstackEnv}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": shotstackKey },
      body: JSON.stringify(job.edit_json),
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
    .from("video_edit_jobs")
    .update({ status: "rendering", shotstack_render_id: shotstackId, updated_at: new Date().toISOString() })
    .eq("id", jobId);

  return jsonResponse({ success: true, jobId, shotstackRenderId: shotstackId }, 200);
});

// Supabase Edge Function — renders personalised Guest Reels with
// Shotstack. One function, two actions:
//
//   { reelId, action: "submit" } — submits the edit already stored on
//     the guest_reels row (built server-side by services/guest-reels.ts's
//     queueGuestReel) and records Shotstack's render id.
//   { reelId, action: "status" } — checks the render; once done, copies
//     the MP4 into our private `videos` bucket and marks the reel done.
//
// Unlike generate-slideshow-video, this function never accepts slides or
// any other content from the caller — it only renders what the Next.js
// server stored after checking the admin's access and quota, so calling
// it directly can't run up Shotstack costs with arbitrary renders.
// Called server-side (supabaseAdmin().functions.invoke) by
// features/admin/reels/actions.ts.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

interface RequestBody {
  reelId?: string;
  action?: "submit" | "status";
}

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

interface ReelRow {
  id: string;
  event_id: string;
  status: string;
  edit: unknown;
  shotstack_render_id: string | null;
  result_path: string | null;
  error_message: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ success: false, error: "Method not allowed" }, 405);

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ success: false, error: "Invalid request body" }, 400);
  }
  const { reelId, action } = body;
  if (!reelId || (action !== "submit" && action !== "status")) {
    return jsonResponse({ success: false, error: "Missing reelId or action" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const shotstackKey = Deno.env.get("SHOTSTACK_API_KEY");
  // Same switch as generate-slideshow-video: "stage" for a free sandbox key (watermarked), "v1" for production.
  const shotstackEnv = Deno.env.get("SHOTSTACK_ENV") || "v1";
  if (!supabaseUrl || !serviceRoleKey || !shotstackKey) {
    console.error("guest-reel-render: missing required environment variables");
    return jsonResponse({ success: false, error: "Reel rendering isn't configured (SHOTSTACK_API_KEY)." }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: reel, error: lookupError } = await supabase
    .from("guest_reels")
    .select("id, event_id, status, edit, shotstack_render_id, result_path, error_message")
    .eq("id", reelId)
    .maybeSingle<ReelRow>();
  if (lookupError) return jsonResponse({ success: false, error: "Lookup failed" }, 500);
  if (!reel) return jsonResponse({ success: false, error: "Reel not found" }, 404);

  async function setError(message: string) {
    console.error(`guest-reel-render: reel ${reelId} failed: ${message}`);
    await supabase
      .from("guest_reels")
      .update({ status: "error", error_message: message.slice(0, 2000), updated_at: new Date().toISOString() })
      .eq("id", reelId);
    return jsonResponse({ success: true, status: "error", error: message });
  }

  if (action === "submit") {
    if (reel.status !== "queued") return jsonResponse({ success: true, status: reel.status });
    try {
      const res = await fetch(`https://api.shotstack.io/edit/${shotstackEnv}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": shotstackKey },
        body: JSON.stringify(reel.edit),
      });
      const payload = await res.json();
      const id = payload?.response?.id;
      if (!res.ok || !id) {
        const message = payload?.message || payload?.response?.message || `Shotstack returned ${res.status}`;
        return await setError(`Shotstack rejected the reel: ${message}`);
      }
      await supabase
        .from("guest_reels")
        .update({ status: "rendering", shotstack_render_id: id, updated_at: new Date().toISOString() })
        .eq("id", reelId)
        .eq("status", "queued");
      return jsonResponse({ success: true, status: "rendering" });
    } catch (err) {
      return await setError(`Couldn't reach Shotstack: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  // action === "status"
  if (reel.status !== "rendering" || !reel.shotstack_render_id) {
    return jsonResponse({ success: true, status: reel.status, error: reel.error_message });
  }

  let renderStatus: string;
  let renderUrl: string | null = null;
  let renderError: string | null = null;
  try {
    const res = await fetch(`https://api.shotstack.io/edit/${shotstackEnv}/render/${reel.shotstack_render_id}`, {
      headers: { "x-api-key": shotstackKey },
    });
    const payload = await res.json();
    if (!res.ok || !payload?.response) throw new Error(payload?.message || `Shotstack returned ${res.status}`);
    renderStatus = payload.response.status;
    renderUrl = payload.response.url ?? null;
    renderError = payload.response.error ?? null;
  } catch (err) {
    // Transient — the next poll will try again.
    console.error(`guest-reel-render: status check failed for ${reelId}:`, err);
    return jsonResponse({ success: true, status: "rendering" });
  }

  if (renderStatus === "failed") return await setError(renderError || "Shotstack couldn't render this reel.");
  if (renderStatus !== "done" || !renderUrl) return jsonResponse({ success: true, status: "rendering" });

  try {
    const videoRes = await fetch(renderUrl);
    if (!videoRes.ok) throw new Error(`Download failed (${videoRes.status})`);
    const bytes = new Uint8Array(await videoRes.arrayBuffer());
    const path = `${reel.event_id}/reels/${reel.id}-${Date.now()}.mp4`;
    const { error: uploadError } = await supabase.storage
      .from("videos")
      .upload(path, bytes, { contentType: "video/mp4", upsert: false });
    if (uploadError) throw new Error(uploadError.message);

    await supabase
      .from("guest_reels")
      .update({ status: "done", result_path: path, error_message: null, updated_at: new Date().toISOString() })
      .eq("id", reelId);
    // Replace, don't accumulate: drop the previous version of this guest's reel.
    if (reel.result_path && reel.result_path !== path) await supabase.storage.from("videos").remove([reel.result_path]);
    return jsonResponse({ success: true, status: "done" });
  } catch (err) {
    return await setError(`Couldn't save the finished reel: ${err instanceof Error ? err.message : "unknown error"}`);
  }
});

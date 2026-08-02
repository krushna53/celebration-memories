// Supabase Edge Function — generates an AI image and stores it, entirely
// within one synchronous request/response.
//
// This replaces an earlier design built around a Netlify Background
// Function: browser fires a trigger, background function runs
// out-of-band, browser polls a job row for the result. That design was
// abandoned after extensive debugging (see README's AI Image section)
// established the trigger request was reliably failing to actually
// execute on Netlify's side for reasons never fully diagnosed, despite
// the function being confirmed correctly deployed.
//
// Edge Functions make the simpler design viable: the wall-clock limit
// here is 150s on the free plan (400s on paid) — comfortably more than
// OpenAI's image API's usual 30-60s — so there's no need to return
// early and finish the work "in the background" at all. The browser
// just calls this function and awaits the real result directly. No
// trigger-and-hope, no polling, no silent-failure window: if this
// fails, the browser's fetch() promise rejects or resolves with an
// error body, immediately and visibly.
//
// The `ai_image_jobs` row is still created up front by the Next.js
// Server Action (generateAiImageAction in
// features/admin/ai-image/actions.ts) — that's where the per-event
// quota check for client-role admins happens, and it's a fast,
// synchronous DB insert with no reason to move. This function just
// picks up that job by id, does the real work, and updates it.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import OpenAI from "npm:openai@6";

interface RequestBody {
  jobId: string;
  eventId: string;
  prompt: string;
}

// The browser calls this function directly (see ai-image-generator.tsx),
// so it needs to answer CORS preflight (OPTIONS) requests and include
// these headers on every response — Supabase's API gateway bypasses
// /functions/v1/* entirely (the Edge Runtime does its own JWT check per
// verify_jwt), so CORS is this function's own responsibility, not
// something the platform adds for us.
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

  const { jobId, eventId, prompt } = body;
  if (!jobId || !eventId || !prompt) {
    return jsonResponse({ success: false, error: "Missing jobId, eventId, or prompt" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");

  if (!supabaseUrl || !serviceRoleKey || !openaiKey) {
    console.error("generate-ai-image: missing required environment variables");
    return jsonResponse({ success: false, error: "Not configured" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Guard, same reasoning as the Netlify version had: confirm the job is
  // real, still pending/processing, and actually belongs to the eventId
  // the caller supplied — never trust the caller-supplied eventId for
  // anything (like the Storage path below) beyond matching what the job
  // was actually created with.
  const { data: job, error: lookupError } = await supabase
    .from("ai_image_jobs")
    .select("status, event_id, admin_id")
    .eq("id", jobId)
    .maybeSingle<{ status: string; event_id: string; admin_id: string }>();

  if (lookupError) {
    console.error(`generate-ai-image: lookup failed for job ${jobId}:`, lookupError.message);
    return jsonResponse({ success: false, error: "Lookup failed" }, 500);
  }
  if (!job) {
    return jsonResponse({ success: false, error: "Job not found" }, 404);
  }
  if (job.event_id !== eventId) {
    return jsonResponse({ success: false, error: "Job/event mismatch" }, 400);
  }
  if (job.status === "done") {
    return jsonResponse({ success: false, error: "Job already completed" }, 409);
  }

  async function fail(message: string, status: number) {
    console.error(`generate-ai-image: job ${jobId} failed: ${message}`);
    await supabase
      .from("ai_image_jobs")
      .update({ status: "error", error_message: message.slice(0, 2000), updated_at: new Date().toISOString() })
      .eq("id", jobId);
    return jsonResponse({ success: false, error: message }, status);
  }

  await supabase
    .from("ai_image_jobs")
    .update({ status: "processing", updated_at: new Date().toISOString() })
    .eq("id", jobId);

  try {
    const openai = new OpenAI({ apiKey: openaiKey });
    const model = Deno.env.get("OPENAI_IMAGE_MODEL") || "gpt-image-2";

    // quality: "high" (not the previous "medium") — gpt-image-2 renders
    // any text requested in the prompt (captions, banners, names) as
    // actual pixels, same as everything else in the image. At "medium"
    // quality the model spends less compute per image and fine detail
    // like letterforms is the first thing to blur/garble or get dropped
    // entirely; "high" fixes that at the cost of a slower/pricier call.
    // If a generated image is still missing text after this, the prompt
    // itself needs to ask for it explicitly and put the exact text in
    // quotes (e.g. `a birthday banner with the text "Happy 75th, Mahesh!"`)
    // — gpt-image-2 won't infer wording that isn't in the prompt.
    const response = await openai.images.generate({
      model,
      prompt,
      size: "1024x1024",
      quality: "high",
      n: 1,
    });

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) {
      return await fail("OpenAI didn't return an image.", 502);
    }

    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const path = `${eventId}/ai-generated/${crypto.randomUUID()}.png`;

    const { error: uploadError } = await supabase.storage
      .from("gallery")
      .upload(path, bytes, { contentType: "image/png", upsert: false });

    if (uploadError) {
      return await fail(`Failed to save generated image: ${uploadError.message}`, 502);
    }

    await supabase
      .from("ai_image_jobs")
      .update({ status: "done", result_path: path, updated_at: new Date().toISOString() })
      .eq("id", jobId);

    // Mirrors services/ai-image-generations.ts's recordAiImageGeneration.
    await supabase.from("ai_image_generations").insert({
      event_id: eventId,
      admin_id: job.admin_id,
      prompt: prompt.slice(0, 2000),
    });

    const { data: pub } = supabase.storage.from("gallery").getPublicUrl(path);

    return jsonResponse({ success: true, resultPath: path, resultUrl: pub.publicUrl }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error calling OpenAI.";
    return await fail(`OpenAI image generation failed: ${message}`, 502);
  }
});

// Supabase Edge Function — generates the image for the public, no-login
// AI invitation-image tool (app/ai-invitation-image/page.tsx).
//
// Why an Edge Function: OpenAI image generation routinely takes 20-60s,
// past Netlify's synchronous function limit. The original design called
// OpenAI straight from app/api/public-ai-image/route.ts and was killed
// mid-request every time (0 successful generations in production). Edge
// Functions get 150s+ of wall-clock time — the same reason the admin AI
// Image tool uses supabase/functions/generate-ai-image.
//
// Authorization is the single-use ticket, not the caller: the Next.js
// route (the rate-limit enforcement point) inserts a 'pending' row in
// public_ai_image_requests holding the validated prompt, and this
// function atomically claims it. The prompt is read from that row,
// never from the request body, so a caller can't swap in an unvalidated
// prompt, and a ticket can't be replayed for a second image.
//
// No Storage write — the PNG goes back as a base64 data URL, same as
// the original design (nothing to persist, moderate, or purge).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import OpenAI from "npm:openai@6";

/** Tickets older than this are refused — the browser calls this immediately after receiving one. */
const TICKET_MAX_AGE_MS = 10 * 60 * 1000;

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
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  let ticketId: unknown;
  try {
    ({ ticketId } = await req.json());
  } catch {
    return jsonResponse({ error: "Invalid request." }, 400);
  }
  if (typeof ticketId !== "string" || !ticketId) return jsonResponse({ error: "Invalid request." }, 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!supabaseUrl || !serviceRoleKey || !openaiKey) {
    console.error("generate-public-ai-image: missing required environment variables");
    return jsonResponse({ error: "This tool isn't configured right now. Please try again later." }, 503);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Atomic claim: only one request can ever move a given ticket out of
  // 'pending', so a replayed or duplicated call gets nothing.
  const { data: ticket, error: claimError } = await supabase
    .from("public_ai_image_requests")
    .update({ status: "processing" })
    .eq("id", ticketId)
    .eq("status", "pending")
    .gte("created_at", new Date(Date.now() - TICKET_MAX_AGE_MS).toISOString())
    .select("prompt")
    .maybeSingle<{ prompt: string | null }>();

  if (claimError) {
    console.error("generate-public-ai-image: claim failed:", claimError.message);
    return jsonResponse({ error: "Something went wrong. Please try again." }, 500);
  }
  if (!ticket?.prompt) {
    return jsonResponse({ error: "This request has expired — please try generating again." }, 410);
  }

  // Refund the visitor's allowance on any failure — mirrors the old
  // route's "only record after a successful generation" behavior.
  async function fail(message: string, status: number, logDetail?: string) {
    console.error(`generate-public-ai-image: ticket ${ticketId} failed: ${logDetail ?? message}`);
    await supabase.from("public_ai_image_requests").delete().eq("id", ticketId);
    return jsonResponse({ error: message }, status);
  }

  try {
    const openai = new OpenAI({ apiKey: openaiKey });
    const response = await openai.images.generate({
      model: Deno.env.get("OPENAI_IMAGE_MODEL") || "gpt-image-2",
      prompt: ticket.prompt,
      size: "1024x1024",
      // "medium" keeps per-image cost low for an unauthenticated tool
      // (see services/public-ai-image-rate-limit.ts's cost note).
      quality: "medium",
      n: 1,
    });

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) return await fail("The image couldn't be generated. Please try again.", 502, "OpenAI returned no image");

    await supabase.from("public_ai_image_requests").update({ status: "done" }).eq("id", ticketId);
    return jsonResponse({ dataUrl: `data:image/png;base64,${b64}` }, 200);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    // OpenAI's safety system rejects some prompts — worth telling the
    // visitor plainly, since rewording is the fix.
    const blocked = /safety|moderation|content_policy/i.test(detail);
    return await fail(
      blocked
        ? "That description was blocked by the image safety filter — try rewording it."
        : "The image couldn't be generated. Please try again.",
      502,
      detail,
    );
  }
});

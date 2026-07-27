import type { Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

/**
 * Netlify Background Function — the actual OpenAI image generation call,
 * moved here from the Next.js Server Action (features/admin/ai-image/actions.ts)
 * specifically because it can take 30-60s+, which reliably exceeds
 * Netlify's synchronous function limit (10s on the free plan, 26s max on
 * paid plans) and caused 502s. Background Functions get up to 15 minutes
 * and are available on every plan tier, including free — see
 * https://docs.netlify.com/build/functions/background-functions.
 *
 * IMPORTANT — this file is bundled independently of the Next.js app by
 * Netlify's own function bundler, which does not resolve this project's
 * "@/..." path aliases from tsconfig.json. That's why this deliberately
 * duplicates the small amount of logic from lib/ai-image.ts and
 * services/uploads.ts/ai-image-generations.ts rather than importing
 * them — cross-importing app code into netlify/functions is a common
 * source of silent build/runtime failures on Netlify and isn't worth
 * the risk for ~30 lines of logic. If lib/ai-image.ts's model/quality
 * defaults change, mirror the change here too.
 *
 * Background Functions respond with an empty 202 immediately — there is
 * no way to stream the result back to the original request. Instead,
 * this function updates the ai_image_jobs row directly, and the client
 * polls getAiImageJobStatusAction (features/admin/ai-image/actions.ts)
 * until status flips to "done" or "error".
 *
 * This is triggered directly from the browser (see handleGenerate in
 * features/admin/ai-image/ai-image-generator.tsx), not from the Server
 * Action that creates the job — a server-to-server trigger from the
 * Server Action turned out to be unreliable in practice. Because that
 * means this endpoint is reachable with any client-supplied jobId, it
 * looks the job up and confirms it's actually in "pending"/"processing"
 * state before spending any OpenAI credits — see the guard below.
 */

interface RequestBody {
  jobId: string;
  eventId: string;
  prompt: string;
}

async function handler(req: Request): Promise<Response> {
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid request body", { status: 400 });
  }

  const { jobId, eventId, prompt } = body;
  if (!jobId || !eventId || !prompt) {
    return new Response("Missing jobId, eventId, or prompt", { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!supabaseUrl || !serviceRoleKey || !openaiKey) {
    console.error("generate-ai-image-background: missing required environment variables");
    return new Response("Not configured", { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Guard against spending OpenAI credits on a forged/replayed/already-
  // finished job now that this endpoint is triggered directly from the
  // browser rather than only from a trusted server-to-server call.
  const { data: existingJob, error: lookupError } = await supabase
    .from("ai_image_jobs")
    .select("status, event_id")
    .eq("id", jobId)
    .maybeSingle<{ status: string; event_id: string }>();

  if (lookupError) {
    console.error(`generate-ai-image-background: failed to look up job ${jobId}: ${lookupError.message}`);
    return new Response("Lookup failed", { status: 500 });
  }
  if (!existingJob) {
    return new Response("Job not found", { status: 404 });
  }
  if (existingJob.event_id !== eventId) {
    // Don't trust the caller-supplied eventId for anything (e.g. the
    // Storage path below) beyond matching what the job was actually
    // created with — prevents a forged eventId from landing a generated
    // image in a different event's gallery folder.
    return new Response("Job/event mismatch", { status: 400 });
  }
  if (existingJob.status === "done") {
    // Already succeeded (e.g. a duplicate/replayed trigger) — nothing to do.
    return new Response(null, { status: 202 });
  }

  async function fail(message: string) {
    console.error(`generate-ai-image-background: job ${jobId} failed: ${message}`);
    await supabase
      .from("ai_image_jobs")
      .update({ status: "error", error_message: message.slice(0, 2000), updated_at: new Date().toISOString() })
      .eq("id", jobId);
  }

  try {
    await supabase
      .from("ai_image_jobs")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", jobId);

    const openai = new OpenAI({ apiKey: openaiKey });
    const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";

    const response = await openai.images.generate({
      model,
      prompt,
      size: "1024x1024",
      quality: "medium",
      n: 1,
    });

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) {
      await fail("OpenAI didn't return an image.");
      return new Response(null, { status: 202 });
    }

    const buffer = Buffer.from(b64, "base64");
    const path = `${eventId}/ai-generated/${crypto.randomUUID()}.png`;

    const { error: uploadError } = await supabase.storage
      .from("gallery")
      .upload(path, buffer, { contentType: "image/png", upsert: false });

    if (uploadError) {
      await fail(`Failed to save generated image: ${uploadError.message}`);
      return new Response(null, { status: 202 });
    }

    await supabase
      .from("ai_image_jobs")
      .update({ status: "done", result_path: path, updated_at: new Date().toISOString() })
      .eq("id", jobId);

    // Mirrors services/ai-image-generations.ts's recordAiImageGeneration —
    // duplicated here for the same cross-bundle-import reason as above.
    const { data: job } = await supabase
      .from("ai_image_jobs")
      .select("admin_id")
      .eq("id", jobId)
      .maybeSingle<{ admin_id: string }>();

    if (job) {
      await supabase.from("ai_image_generations").insert({
        event_id: eventId,
        admin_id: job.admin_id,
        prompt: prompt.slice(0, 2000),
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error calling OpenAI.";
    await fail(`OpenAI image generation failed: ${message}`);
  }

  return new Response(null, { status: 202 });
}

export default handler;

// Deliberately no custom `path` here — this deploys at Netlify's own
// reserved invocation path, /.netlify/functions/generate-ai-image-background,
// which the platform guarantees is never intercepted by the
// @netlify/plugin-nextjs framework's routing (unlike a custom `path`,
// which can end up shadowed by the framework's catch-all handler on
// some sites). See resolveSiteOrigin()'s caller in
// features/admin/ai-image/actions.ts for the matching trigger URL.
export const config: Config = {
  background: true,
};

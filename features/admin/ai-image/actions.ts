"use server";

import { getCurrentAdmin } from "@/services/admin-auth";
import { getEventById } from "@/services/events";
import { AI_IMAGE_CONFIGURED } from "@/lib/ai-image";
import { createAiImageJob } from "@/services/ai-image-jobs";
import { countAiImageGenerations } from "@/services/ai-image-generations";
import { createSignedAiImageUpload } from "@/services/uploads";

export type StartAiImageResult =
  | { success: true; jobId: string; remaining: number | null }
  | { success: false; error: string };

/**
 * Available to both owner and client roles — but client accounts are
 * capped per event (events.ai_image_generation_limit, default 15;
 * owner is exempt) since this calls a real per-image-cost API with no
 * billing pass-through to clients yet. See services/ai-image-generations.ts.
 *
 * This ONLY creates a job row — it deliberately does not call OpenAI
 * itself. The actual generation runs in a Supabase Edge Function
 * (supabase/functions/generate-ai-image/index.ts), called directly by
 * the browser right after this action returns a jobId (see
 * handleGenerate in ai-image-generator.tsx), and awaited synchronously —
 * Edge Functions get up to 150s (free plan) / 400s (paid) of wall-clock
 * time per request, comfortably more than OpenAI's usual 30-60s, so
 * there's no need for a fire-and-forget trigger or a polling loop at
 * all: the browser just waits for the real response.
 *
 * This replaces an earlier design built around a Netlify Background
 * Function (trigger-and-poll). That design was abandoned after
 * extensive debugging established the trigger request was reliably
 * failing to actually execute on Netlify's side — confirmed correctly
 * deployed and bundled, accepting invocations with a 202, yet never
 * producing a single log line or database update, across every trigger
 * mechanism tried (server-to-server fetch, various origin/path fixes,
 * client-side fetch with and without keepalive). See the README's AI
 * Image section for the full history if this ever needs revisiting.
 */
export async function generateAiImageAction(eventId: string, prompt: string): Promise<StartAiImageResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { success: false, error: "Not authorized." };

  if (!AI_IMAGE_CONFIGURED) {
    return { success: false, error: "AI image generation isn't configured — add OPENAI_API_KEY to enable it." };
  }

  if (!prompt.trim()) {
    return { success: false, error: "Please describe the image you want." };
  }

  let remaining: number | null = null;

  if (admin.role === "client") {
    // Re-fetch the event server-side for the limit rather than trusting
    // a client-supplied number — mirrors the pattern used elsewhere
    // (e.g. re-resolving an invitee from a token) so nothing about
    // authorization depends on values the browser sent. Looked up by
    // the eventId the caller passed (this event, not necessarily the
    // flagship EVENT_SLUG one — a client admin could be scoped to any
    // event created through the wizard).
    const event = await getEventById(eventId);
    const limit = event?.aiImageGenerationLimit ?? 5;
    const used = await countAiImageGenerations(eventId);

    if (used >= limit) {
      return {
        success: false,
        error: `You've reached the AI image limit for this event (${limit}). Contact your site admin to raise it.`,
      };
    }
    remaining = limit - used - 1;
  }

  try {
    const jobId = await createAiImageJob({ eventId, adminId: admin.id, prompt: prompt.trim() });
    return { success: true, jobId, remaining };
  } catch (err) {
    console.error("generateAiImageAction: failed to create job row:", err);
    return { success: false, error: "Something went wrong starting the generation. Please try again." };
  }
}

export type RequestUploadUrlResult =
  | { success: true; data: { bucket: string; path: string; token: string } }
  | { success: false; error: string };

/**
 * The "Upload your own" alternative to generateAiImageAction — for an
 * admin who already has an invitation image (designed elsewhere, sent
 * by the client, etc.) and doesn't want to spend an AI generation
 * making one. Issues a signed Storage upload URL; the browser uploads
 * directly to it (see handleUpload in ai-image-generator.tsx), then the
 * uploaded file's public URL is used exactly like a generated one — no
 * quota/cap applies since no paid API call happens here.
 */
export async function requestAiImageUploadUrlAction(
  eventId: string,
  fileName: string,
  contentType: string,
  fileSize: number,
): Promise<RequestUploadUrlResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { success: false, error: "Not authorized." };

  try {
    const upload = await createSignedAiImageUpload({ eventId, fileName, contentType, fileSize });
    return { success: true, data: upload };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Upload failed." };
  }
}

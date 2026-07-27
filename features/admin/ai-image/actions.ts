"use server";

import { getCurrentAdmin } from "@/services/admin-auth";
import { getEventBySlug } from "@/services/events";
import { EVENT_SLUG } from "@/lib/constants";
import { AI_IMAGE_CONFIGURED } from "@/lib/ai-image";
import { createAiImageJob, getAiImageJob } from "@/services/ai-image-jobs";
import { countAiImageGenerations } from "@/services/ai-image-generations";
import type { AiImageJobRecord } from "@/types/ai-image-job";

export type StartAiImageResult =
  | { success: true; jobId: string; remaining: number | null }
  | { success: false; error: string };

/**
 * Available to both owner and client roles — but client accounts are
 * capped per event (events.ai_image_generation_limit, default 15;
 * owner is exempt) since this calls a real per-image-cost API with no
 * billing pass-through to clients yet. See services/ai-image-generations.ts.
 *
 * This ONLY creates a job row — it deliberately does not call OpenAI,
 * and it deliberately does not trigger the Netlify Background Function
 * either (netlify/functions/generate-ai-image-background.mts). That
 * trigger used to happen here, as a server-to-server fetch from this
 * Server Action, but that turned out to be unreliable in practice
 * across several fix attempts (site-origin resolution, custom vs.
 * reserved function paths, awaited vs. fire-and-forget) — jobs kept
 * ending up stuck at "pending" with zero invocations ever reaching the
 * function, consistent with the outbound request never actually
 * completing before this Lambda-based Server Action's own execution
 * environment was torn down.
 *
 * The trigger now happens client-side instead (see
 * ai-image-generator.tsx's handleGenerate, right after this action
 * returns a jobId), using `fetch(..., { keepalive: true })` — the same
 * mechanism browsers use for analytics beacons, specifically designed
 * to survive the calling context going away. A real browser tab isn't
 * subject to the "may be frozen the instant a response is sent" behavior
 * a serverless function invocation is, which removes the failure mode
 * entirely rather than working around it.
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
    // authorization depends on values the browser sent.
    const event = await getEventBySlug(EVENT_SLUG);
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

export type AiImageJobStatusResult = AiImageJobRecord | { status: "not_found" };

/** Polled by the client every couple of seconds until status is "done" or "error". */
export async function getAiImageJobStatusAction(jobId: string): Promise<AiImageJobStatusResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { status: "not_found" };

  try {
    const job = await getAiImageJob(jobId);
    return job ?? { status: "not_found" };
  } catch (err) {
    console.error("getAiImageJobStatusAction failed:", err);
    return { status: "not_found" };
  }
}

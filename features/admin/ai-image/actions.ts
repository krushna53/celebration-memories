"use server";

import { headers } from "next/headers";

import { getCurrentAdmin } from "@/services/admin-auth";
import { getEventBySlug } from "@/services/events";
import { EVENT_SLUG, SITE_URL } from "@/lib/constants";
import { AI_IMAGE_CONFIGURED } from "@/lib/ai-image";
import { createAiImageJob, getAiImageJob } from "@/services/ai-image-jobs";
import { countAiImageGenerations } from "@/services/ai-image-generations";
import type { AiImageJobRecord } from "@/types/ai-image-job";

/**
 * Where to reach *this* deployment for the background function trigger
 * below. Previously this only used SITE_URL (from NEXT_PUBLIC_SITE_URL),
 * which defaults to a placeholder domain if that env var isn't set on a
 * given Netlify site — silently sending the trigger request nowhere, so
 * the background function never ran and jobs sat at "pending" forever
 * with no visible error. Deriving the origin from the incoming request's
 * own headers (which Netlify always sets correctly) makes this
 * self-correct regardless of whether NEXT_PUBLIC_SITE_URL was configured
 * for this specific site.
 */
async function resolveSiteOrigin(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host");
    const proto = h.get("x-forwarded-proto") || "https";
    if (host) return `${proto}://${host}`;
  } catch (err) {
    console.error("resolveSiteOrigin: headers() unavailable, falling back to SITE_URL:", err);
  }
  return SITE_URL;
}

export type StartAiImageResult =
  | { success: true; jobId: string; remaining: number | null }
  | { success: false; error: string };

/**
 * Available to both owner and client roles — but client accounts are
 * capped per event (events.ai_image_generation_limit, default 15;
 * owner is exempt) since this calls a real per-image-cost API with no
 * billing pass-through to clients yet. See services/ai-image-generations.ts.
 *
 * This only creates a job row and triggers the Netlify Background
 * Function (netlify/functions/generate-ai-image-background.mts) — it
 * deliberately does NOT call OpenAI itself. OpenAI's image API routinely
 * takes 30-60s+, which reliably exceeds Netlify's synchronous function
 * limit (10s free plan) and produced 502s. The actual generation now
 * happens out-of-band; the client polls getAiImageJobStatusAction below
 * until the job flips to "done" or "error".
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

  let jobId: string;
  try {
    jobId = await createAiImageJob({ eventId, adminId: admin.id, prompt: prompt.trim() });
  } catch (err) {
    console.error("generateAiImageAction: failed to create job row:", err);
    return { success: false, error: "Something went wrong starting the generation. Please try again." };
  }

  // Trigger the background function. This IS awaited — but only for the
  // Background Function's own near-instant 202 acknowledgement (see
  // Netlify docs), not for the OpenAI work itself, which runs entirely
  // out-of-band afterward. This used to be fire-and-forget (not
  // awaited), which seemed safe since a 202 comes back almost
  // immediately — but on Netlify's Lambda-based runtime, the Server
  // Action's own execution environment can be frozen the instant this
  // function returns its result to the client, which can kill an
  // in-flight outbound request before it finishes sending. Awaiting the
  // ack (still well under the 10s synchronous limit) guarantees the
  // trigger actually reaches the background function instead of
  // silently vanishing, which is what produced jobs stuck at "pending"
  // forever with zero invocations ever reaching the function.
  try {
    const origin = await resolveSiteOrigin();
    const res = await fetch(`${origin}/.netlify/functions/generate-ai-image-background`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, eventId, prompt: prompt.trim() }),
    });
    if (!res.ok) {
      throw new Error(`Background function trigger returned ${res.status}`);
    }
  } catch (err) {
    console.error("Failed to trigger AI image background function:", err);
    return {
      success: false,
      error: "Couldn't start image generation — please try again in a moment.",
    };
  }

  return { success: true, jobId, remaining };
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

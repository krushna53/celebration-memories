"use server";

import { revalidatePath } from "next/cache";

import { getCurrentAdmin } from "@/services/admin-auth";
import { generateAiImage, AiImageError } from "@/lib/ai-image";
import { uploadGeneratedImage } from "@/services/uploads";
import { getEventBySlug } from "@/services/events";
import { EVENT_SLUG } from "@/lib/constants";
import {
  countAiImageGenerations,
  recordAiImageGeneration,
} from "@/services/ai-image-generations";

export type GenerateAiImageResult =
  | { success: true; url: string; path: string; remaining: number | null }
  | { success: false; error: string };

/**
 * Available to both owner and client roles — but client accounts are
 * capped per event (events.ai_image_generation_limit, default 15;
 * owner is exempt) since this calls a real per-image-cost API with no
 * billing pass-through to clients yet. See services/ai-image-generations.ts.
 */
export async function generateAiImageAction(
  eventId: string,
  prompt: string,
): Promise<GenerateAiImageResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { success: false, error: "Not authorized." };

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
    const image = await generateAiImage({ prompt: prompt.trim() });
    const uploaded = await uploadGeneratedImage({
      eventId,
      buffer: image.buffer,
      contentType: image.contentType,
    });
    await recordAiImageGeneration({ eventId, adminId: admin.id, prompt: prompt.trim() });
    revalidatePath("/admin/ai-image");
    return { success: true, url: uploaded.url, path: uploaded.path, remaining };
  } catch (err) {
    if (err instanceof AiImageError) {
      return { success: false, error: err.message };
    }
    console.error("generateAiImageAction failed:", err);
    return { success: false, error: "Something went wrong generating the image. Please try again." };
  }
}

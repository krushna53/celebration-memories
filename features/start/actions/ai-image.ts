"use server";

import { requireDraftEvent } from "@/features/start/draft-auth";
import { AI_IMAGE_CONFIGURED } from "@/lib/ai-image";
import { createAiImageJob } from "@/services/ai-image-jobs";
import { countAiImageGenerations } from "@/services/ai-image-generations";
import { createSignedAiImageUpload } from "@/services/uploads";
import type { StartAiImageResult, RequestUploadUrlResult } from "@/features/admin/ai-image/actions";

/**
 * Real per-image cost applies (OpenAI) — a draft has no admin/client
 * role to key a quota off of, so this is a flat cap keyed to the draft
 * event itself, same enforcement mechanism as the client role's
 * per-event limit (see events.ai_image_generation_limit) just with a
 * fixed number instead of an admin-configurable one.
 */
const DRAFT_AI_IMAGE_LIMIT = 5;

/**
 * Draft-token-gated mirror of generateAiImageAction — same shape, but
 * authorizes via requireDraftEvent(token) instead of getCurrentAdmin().
 * See features/admin/ai-image/actions.ts for the admin original and
 * AiImageActions in ai-image-generator.tsx for how this gets bound in.
 */
export async function draftGenerateAiImageAction(token: string, eventId: string, prompt: string): Promise<StartAiImageResult> {
  try {
    const event = await requireDraftEvent(token);
    if (event.id !== eventId) return { success: false, error: "This link doesn't match that event." };

    if (!AI_IMAGE_CONFIGURED) {
      return { success: false, error: "AI image generation isn't configured — add OPENAI_API_KEY to enable it." };
    }
    if (!prompt.trim()) {
      return { success: false, error: "Please describe the image you want." };
    }

    const used = await countAiImageGenerations(event.id);
    if (used >= DRAFT_AI_IMAGE_LIMIT) {
      return {
        success: false,
        error: `You've reached the ${DRAFT_AI_IMAGE_LIMIT}-image limit for previewing an event before creating an account.`,
      };
    }

    const jobId = await createAiImageJob({ eventId: event.id, adminId: null, prompt: prompt.trim() });
    return { success: true, jobId, remaining: null };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}

/**
 * Draft-token-gated mirror of requestAiImageUploadUrlAction — same
 * shape, but authorizes via requireDraftEvent(token) instead of
 * getCurrentAdmin(). No generation-quota check here since uploading
 * doesn't call any paid API.
 */
export async function draftRequestAiImageUploadUrlAction(
  token: string,
  eventId: string,
  fileName: string,
  contentType: string,
  fileSize: number,
): Promise<RequestUploadUrlResult> {
  try {
    const event = await requireDraftEvent(token);
    if (event.id !== eventId) return { success: false, error: "This link doesn't match that event." };

    const upload = await createSignedAiImageUpload({ eventId: event.id, fileName, contentType, fileSize });
    return { success: true, data: upload };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Upload failed." };
  }
}

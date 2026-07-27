"use server";

import { requireDraftEvent } from "@/features/start/draft-auth";
import { createSlideshowVideoJob } from "@/services/slideshow-video-jobs";
import { countSlideshowVideoGenerations } from "@/services/slideshow-video-generations";
import { createSignedSlideshowMusicUpload, UploadValidationError } from "@/services/uploads";
import type { StartSlideshowVideoResult, RequestSlideshowMusicUploadResult } from "@/features/admin/slideshow/actions";

/** Real per-minute Shotstack cost applies — flat cap for the same reason as DRAFT_AI_IMAGE_LIMIT in actions/ai-image.ts. */
const DRAFT_SLIDESHOW_LIMIT = 3;

/**
 * Draft-token-gated mirror of startSlideshowVideoAction. See
 * features/admin/slideshow/actions.ts for the admin original.
 */
export async function draftStartSlideshowVideoAction(token: string, eventId: string): Promise<StartSlideshowVideoResult> {
  try {
    const event = await requireDraftEvent(token);
    if (event.id !== eventId) return { success: false, error: "This link doesn't match that event." };

    const used = await countSlideshowVideoGenerations(event.id);
    if (used >= DRAFT_SLIDESHOW_LIMIT) {
      return {
        success: false,
        error: `You've reached the ${DRAFT_SLIDESHOW_LIMIT}-render limit for previewing an event before creating an account.`,
      };
    }

    const jobId = await createSlideshowVideoJob({ eventId: event.id, adminId: null });
    return { success: true, jobId, remaining: null };
  } catch (err) {
    console.error("draftStartSlideshowVideoAction: failed to create job row:", err);
    return { success: false, error: "Something went wrong starting the render. Please try again." };
  }
}

/** Draft-token-gated mirror of requestSlideshowMusicUploadUrlAction — see createSignedSlideshowMusicUpload. */
export async function draftRequestSlideshowMusicUploadUrlAction(
  token: string,
  eventId: string,
  fileName: string,
  contentType: string,
  fileSize: number,
): Promise<RequestSlideshowMusicUploadResult> {
  try {
    const event = await requireDraftEvent(token);
    if (event.id !== eventId) return { success: false, error: "This link doesn't match that event." };

    const upload = await createSignedSlideshowMusicUpload({ eventId: event.id, fileName, contentType, fileSize });
    return { success: true, data: upload };
  } catch (err) {
    if (err instanceof UploadValidationError) return { success: false, error: err.message };
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

"use server";

import { requireAdminForEvent } from "@/services/admin-auth";
import { getEventById } from "@/services/events";
import { createTimelineMovieJob, createUploadedTimelineMovieJob } from "@/services/timeline-movie-jobs";
import { countTimelineMovieGenerations } from "@/services/timeline-movie-generations";
import { createSignedTimelineMovieUpload, publicMediaUrl, UploadValidationError } from "@/services/uploads";

export type StartTimelineMovieResult =
  | { success: true; jobId: string; remaining: number | null }
  | { success: false; error: string };

/**
 * Available to both owner and client roles — but client accounts are
 * capped per event (events.timelineMovieGenerationLimit, default 2;
 * owner is exempt) since this calls HeyGen's paid, per-second-billed
 * avatar video API. See services/timeline-movie-generations.ts.
 *
 * This ONLY creates a queued job row — the actual render is submitted
 * to HeyGen by the generate-timeline-movie Edge Function, called
 * directly by the browser right after this action returns a jobId (see
 * useTimelineMovieJob). Same async, poll-based design as Slideshow
 * Video/Shotstack — see startSlideshowVideoAction's doc comment and the
 * README's "AI Timeline Movie" section for the full flow.
 */
export async function startTimelineMovieAction(eventId: string): Promise<StartTimelineMovieResult> {
  let admin;
  try {
    admin = await requireAdminForEvent(eventId);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Not authorized." };
  }

  let remaining: number | null = null;

  if (admin.role === "client") {
    const event = await getEventById(eventId);
    const limit = event?.timelineMovieGenerationLimit ?? 2;
    const used = await countTimelineMovieGenerations(eventId);

    if (used >= limit) {
      return {
        success: false,
        error: `You've reached the AI Timeline Movie limit for this event (${limit}). Contact your site admin to raise it, or upload your own video instead.`,
      };
    }
    remaining = limit - used - 1;
  }

  try {
    const jobId = await createTimelineMovieJob({ eventId, adminId: admin.id });
    return { success: true, jobId, remaining };
  } catch (err) {
    console.error("startTimelineMovieAction: failed to create job row:", err);
    return { success: false, error: "Something went wrong starting the render. Please try again." };
  }
}

export type RequestTimelineMovieUploadResult =
  | { success: true; data: { bucket: string; path: string; token: string; signedUrl: string } }
  | { success: false; error: string };

/** Issues a signed upload URL for the "upload your own video instead" path — see createSignedTimelineMovieUpload. Not quota-limited (doesn't touch HeyGen). */
export async function requestTimelineMovieUploadUrlAction(
  eventId: string,
  fileName: string,
  contentType: string,
  fileSize: number,
): Promise<RequestTimelineMovieUploadResult> {
  try {
    await requireAdminForEvent(eventId);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Not authorized." };
  }

  try {
    const upload = await createSignedTimelineMovieUpload({ eventId, fileName, contentType, fileSize });
    return { success: true, data: upload };
  } catch (err) {
    if (err instanceof UploadValidationError) return { success: false, error: err.message };
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

export type ConfirmTimelineMovieUploadResult =
  | { success: true; url: string }
  | { success: false; error: string };

/** Called right after the browser's PUT to the signed URL succeeds — records the uploaded file as a completed Timeline Movie job. */
export async function confirmTimelineMovieUploadAction(
  eventId: string,
  path: string,
): Promise<ConfirmTimelineMovieUploadResult> {
  let admin;
  try {
    admin = await requireAdminForEvent(eventId);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Not authorized." };
  }

  try {
    await createUploadedTimelineMovieJob({ eventId, adminId: admin.id, storagePath: path });
    return { success: true, url: publicMediaUrl("videos", path) };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to save the uploaded video." };
  }
}

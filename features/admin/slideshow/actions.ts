"use server";

import { getCurrentAdmin } from "@/services/admin-auth";
import { getEventBySlug } from "@/services/events";
import { EVENT_SLUG } from "@/lib/constants";
import { createSlideshowVideoJob } from "@/services/slideshow-video-jobs";
import { countSlideshowVideoGenerations } from "@/services/slideshow-video-generations";
import { createSignedSlideshowMusicUpload, UploadValidationError } from "@/services/uploads";

export type StartSlideshowVideoResult =
  | { success: true; jobId: string; remaining: number | null }
  | { success: false; error: string };

/**
 * Available to both owner and client roles — but client accounts are
 * capped per event (events.slideshow_video_generation_limit, default 3;
 * owner is exempt) since this calls Shotstack's paid, per-minute-billed
 * rendering API. See services/slideshow-video-generations.ts.
 *
 * This ONLY creates a queued job row — the actual render is submitted to
 * Shotstack by the generate-slideshow-video Edge Function, called
 * directly by the browser right after this action returns a jobId (see
 * handleGenerate in slideshow-composer.tsx). Unlike AI Image, the
 * browser can't just await one call and get the finished video back:
 * Shotstack renders are asynchronous by design (the submit call returns
 * almost immediately with a render id; the render itself typically
 * takes anywhere from ~10s to a couple of minutes to finish). So the
 * browser polls the slideshow-video-status Edge Function every few
 * seconds after submitting, until that function reports the job done or
 * errored. See the README's "Slideshow Video" section for the full flow
 * and why this two-function, poll-based design was chosen over trying to
 * force it into one synchronous call like AI Image.
 */
export async function startSlideshowVideoAction(eventId: string): Promise<StartSlideshowVideoResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { success: false, error: "Not authorized." };

  let remaining: number | null = null;

  if (admin.role === "client") {
    const event = await getEventBySlug(EVENT_SLUG);
    const limit = event?.slideshowVideoGenerationLimit ?? 3;
    const used = await countSlideshowVideoGenerations(eventId);

    if (used >= limit) {
      return {
        success: false,
        error: `You've reached the Slideshow Video limit for this event (${limit}). Contact your site admin to raise it.`,
      };
    }
    remaining = limit - used - 1;
  }

  try {
    const jobId = await createSlideshowVideoJob({ eventId, adminId: admin.id });
    return { success: true, jobId, remaining };
  } catch (err) {
    console.error("startSlideshowVideoAction: failed to create job row:", err);
    return { success: false, error: "Something went wrong starting the render. Please try again." };
  }
}

export type RequestSlideshowMusicUploadResult =
  | { success: true; data: { bucket: string; path: string; token: string; signedUrl: string } }
  | { success: false; error: string };

/** Issues a signed upload URL for an optional background-music file — see createSignedSlideshowMusicUpload. */
export async function requestSlideshowMusicUploadUrlAction(
  eventId: string,
  fileName: string,
  contentType: string,
  fileSize: number,
): Promise<RequestSlideshowMusicUploadResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { success: false, error: "Not authorized." };

  try {
    const upload = await createSignedSlideshowMusicUpload({ eventId, fileName, contentType, fileSize });
    return { success: true, data: upload };
  } catch (err) {
    if (err instanceof UploadValidationError) return { success: false, error: err.message };
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

"use client";

import { useCallback, useRef, useState } from "react";

import { supabaseBrowser } from "@/lib/supabase/client";
import { startSlideshowVideoAction, type StartSlideshowVideoResult } from "@/features/admin/slideshow/actions";

export interface SlideshowVideoSlideInput {
  url: string;
  captionTitle: string | null;
  captionSubtitle: string | null;
}

export interface SlideshowVideoInput {
  eventId: string;
  slides: SlideshowVideoSlideInput[];
  secondsPerPhoto: number;
  audioUrl: string | null;
  showCaptions: boolean;
  theme: { primaryColor: string; secondaryColor: string; fontFamily: string };
}

export type SlideshowVideoStatus = "idle" | "starting" | "processing" | "done" | "error";

const POLL_INTERVAL_MS = 4000;
/** ~6 minutes of polling — comfortably more than Shotstack renders for a modest slideshow typically take. */
const MAX_POLLS = 90;

/**
 * Orchestrates the two-step, poll-based Slideshow Video flow — replaces
 * the old useSlideshowRecorder (client-side canvas + MediaRecorder,
 * removed). See supabase/functions/generate-slideshow-video and
 * supabase/functions/slideshow-video-status, and the README's
 * "Slideshow Video" section for the full design and why this can't be
 * one synchronous call the way AI Image's Edge Function is.
 *
 * `startAction` defaults to the real admin action; the self-serve
 * wizard (features/start/) passes a draft-token-gated override, same
 * pattern as AiImageActions. `anonAuthKey` is the Supabase anon key,
 * used as the Edge Functions' Authorization header when there's no
 * admin session (the wizard) — see the matching comment in
 * ai-image-generator.tsx for why that's safe.
 */
export function useSlideshowVideoJob(
  startAction: (eventId: string) => Promise<StartSlideshowVideoResult> = startSlideshowVideoAction,
  anonAuthKey?: string,
) {
  const [status, setStatus] = useState<SlideshowVideoStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  const cancelledRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    cancelledRef.current = true;
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    setStatus("idle");
    setError(null);
    setVideoUrl(null);
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    setStatus("idle");
  }, []);

  const generate = useCallback(async (input: SlideshowVideoInput) => {
    cancelledRef.current = false;
    setStatus("starting");
    setError(null);
    setVideoUrl(null);

    const started = await startAction(input.eventId);
    if (!started.success) {
      setStatus("error");
      setError(started.error);
      return;
    }
    setRemaining(started.remaining);

    const {
      data: { session },
    } = await supabaseBrowser().auth.getSession();
    const authToken = session?.access_token ?? anonAuthKey;
    if (!authToken) {
      setStatus("error");
      setError("Your session has expired — please sign in again.");
      return;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const authHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    };

    try {
      const startRes = await fetch(`${supabaseUrl}/functions/v1/generate-slideshow-video`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          jobId: started.jobId,
          eventId: input.eventId,
          slides: input.slides,
          secondsPerPhoto: input.secondsPerPhoto,
          audioUrl: input.audioUrl,
          showCaptions: input.showCaptions,
          theme: input.theme,
        }),
      });
      const startOutcome: { success: boolean; error?: string } = await startRes.json();
      if (!startOutcome.success) {
        setStatus("error");
        setError(startOutcome.error || "Something went wrong starting the render.");
        return;
      }
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong starting the render.");
      return;
    }

    setStatus("processing");

    let polls = 0;
    const poll = async (): Promise<void> => {
      if (cancelledRef.current) return;
      polls += 1;
      if (polls > MAX_POLLS) {
        setStatus("error");
        setError("This is taking much longer than expected. Please try again in a bit.");
        return;
      }

      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/slideshow-video-status`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ jobId: started.jobId }),
        });
        const outcome: { success: boolean; status?: string; error?: string; resultUrl?: string } = await res.json();

        if (cancelledRef.current) return;

        if (!outcome.success) {
          setStatus("error");
          setError(outcome.error || "Something went wrong checking the render.");
          return;
        }
        if (outcome.status === "done" && outcome.resultUrl) {
          setVideoUrl(outcome.resultUrl);
          setStatus("done");
          return;
        }
        if (outcome.status === "error") {
          setStatus("error");
          setError(outcome.error || "Something went wrong rendering the video.");
          return;
        }
      } catch (err) {
        // A transient network hiccup while polling shouldn't kill the
        // whole job — just try again on the next tick.
        console.error("slideshow video status poll failed:", err);
      }

      pollTimerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
    };

    await poll();
  }, [startAction, anonAuthKey]);

  return { status, error, videoUrl, remaining, generate, cancel, reset };
}

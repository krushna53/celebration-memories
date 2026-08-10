"use client";

import { useCallback, useRef, useState } from "react";

import { supabaseBrowser } from "@/lib/supabase/client";
import { startTimelineMovieAction, type StartTimelineMovieResult } from "@/features/admin/timeline-movie/actions";

export interface TimelineMovieSceneInput {
  script: string;
  backgroundUrl: string | null;
}

export interface TimelineMovieInput {
  eventId: string;
  scenes: TimelineMovieSceneInput[];
  avatarId: string;
  voiceId: string;
}

export type TimelineMovieStatus = "idle" | "starting" | "processing" | "done" | "error";

const POLL_INTERVAL_MS = 5000;
/** ~8 minutes of polling — HeyGen multi-scene renders can take a few minutes longer than a Shotstack slideshow. */
const MAX_POLLS = 96;

/**
 * Orchestrates the two-step, poll-based AI Timeline Movie flow — see
 * supabase/functions/generate-timeline-movie and
 * supabase/functions/timeline-movie-status, and the README's "AI
 * Timeline Movie" section for the full design. Deliberately mirrors
 * hooks/use-slideshow-video-job.ts almost exactly — same async-render,
 * poll-until-done shape, just against HeyGen instead of Shotstack.
 */
export function useTimelineMovieJob(initialVideoUrl?: string | null) {
  const [status, setStatus] = useState<TimelineMovieStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(initialVideoUrl ?? null);
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

  const generate = useCallback(async (input: TimelineMovieInput) => {
    cancelledRef.current = false;
    setStatus("starting");
    setError(null);
    setVideoUrl(null);

    const started: StartTimelineMovieResult = await startTimelineMovieAction(input.eventId);
    if (!started.success) {
      setStatus("error");
      setError(started.error);
      return;
    }
    setRemaining(started.remaining);

    const {
      data: { session },
    } = await supabaseBrowser().auth.getSession();
    const authToken = session?.access_token;
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
      const startRes = await fetch(`${supabaseUrl}/functions/v1/generate-timeline-movie`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          jobId: started.jobId,
          eventId: input.eventId,
          scenes: input.scenes,
          avatarId: input.avatarId,
          voiceId: input.voiceId,
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
        const res = await fetch(`${supabaseUrl}/functions/v1/timeline-movie-status`, {
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
        // A transient network hiccup while polling shouldn't kill the whole job — just try again on the next tick.
        console.error("timeline movie status poll failed:", err);
      }

      pollTimerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
    };

    await poll();
  }, []);

  return { status, error, videoUrl, remaining, generate, cancel, reset };
}

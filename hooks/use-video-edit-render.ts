"use client";

import { useCallback, useRef, useState } from "react";

import { supabaseBrowser } from "@/lib/supabase/client";

export type VideoEditRenderStatus = "idle" | "starting" | "processing" | "done" | "error";

const POLL_INTERVAL_MS = 4000;
/** ~6 minutes of polling — same budget as useSlideshowVideoJob for a comparably-sized render. */
const MAX_POLLS = 90;

/**
 * Orchestrates the two-step, poll-based Video Editor render flow — same
 * shape as hooks/use-slideshow-video-job.ts (see that file's comment for
 * why this can't be one synchronous call), pointed at
 * supabase/functions/render-video-edit and video-edit-status instead.
 * The one real difference: this hook takes an already-saved jobId
 * (the draft the Studio SDK editor autosaved) rather than creating one
 * itself — see saveVideoEditDraftAction in
 * features/admin/video-editor/actions.ts, called right before this.
 */
export function useVideoEditRender() {
  const [status, setStatus] = useState<VideoEditRenderStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const cancelledRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    setStatus("idle");
  }, []);

  const render = useCallback(async (jobId: string, eventId: string) => {
    cancelledRef.current = false;
    setStatus("starting");
    setError(null);
    setResultUrl(null);

    const {
      data: { session },
    } = await supabaseBrowser().auth.getSession();
    const authToken = session?.access_token ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
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
      const startRes = await fetch(`${supabaseUrl}/functions/v1/render-video-edit`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ jobId, eventId }),
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
        const res = await fetch(`${supabaseUrl}/functions/v1/video-edit-status`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ jobId }),
        });
        const outcome: { success: boolean; status?: string; error?: string; resultUrl?: string } = await res.json();

        if (cancelledRef.current) return;

        if (!outcome.success) {
          setStatus("error");
          setError(outcome.error || "Something went wrong checking the render.");
          return;
        }
        if (outcome.status === "done" && outcome.resultUrl) {
          setResultUrl(outcome.resultUrl);
          setStatus("done");
          return;
        }
        if (outcome.status === "error") {
          setStatus("error");
          setError(outcome.error || "Something went wrong rendering the video.");
          return;
        }
      } catch (err) {
        console.error("video edit status poll failed:", err);
      }

      pollTimerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
    };

    await poll();
  }, []);

  return { status, error, resultUrl, render, cancel };
}

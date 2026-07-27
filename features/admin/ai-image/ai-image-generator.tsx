"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Download, ImagePlus, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { generateAiImageAction, getAiImageJobStatusAction } from "@/features/admin/ai-image/actions";
import { confirmShareImageUploadAction } from "@/features/admin/event-settings/actions";
import { confirmGalleryUploadAction } from "@/features/admin/gallery/actions";
import { GALLERY_CATEGORIES, type GalleryCategory } from "@/features/gallery/gallery-data";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

const LOADING_STEPS = [
  "Extracting event details...",
  "Designing the invitation...",
  "Enhancing details...",
  "Applying your theme...",
  "Still finishing up — this can take up to a minute...",
];

/** How often to check whether the background generation has finished. */
const POLL_INTERVAL_MS = 2500;

/**
 * Give up after this many polls (~3.5 minutes) even if the job never
 * flips out of "pending"/"processing" — this is a client-side backstop
 * alongside the server-side staleness check in services/ai-image-jobs.ts,
 * so the button never gets stuck saying "Still finishing up" forever.
 */
const MAX_POLLS = 84;

const CATEGORY_OPTIONS = GALLERY_CATEGORIES.filter(
  (c): c is { value: GalleryCategory; label: string } => c.value !== "all",
);

interface AiImageGeneratorProps {
  eventId: string;
  defaultPrompt: string;
  configured: boolean;
  /** Non-null only for client-role admins — owner has no cap. */
  quota: { used: number; limit: number } | null;
}

export function AiImageGenerator({ eventId, defaultPrompt, configured, quota }: AiImageGeneratorProps) {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [busy, setBusy] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; path: string } | null>(null);
  const [category, setCategory] = useState<GalleryCategory>("family");
  const [savedTo, setSavedTo] = useState<"share" | "gallery" | null>(null);
  const [remainingOverride, setRemainingOverride] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);

  const remaining = remainingOverride ?? (quota ? quota.limit - quota.used : null);
  const atLimit = remaining !== null && remaining <= 0;

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function stopAll() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (pollRef.current) clearInterval(pollRef.current);
    setBusy(false);
  }

  async function handleGenerate() {
    setBusy(true);
    setError(null);
    setResult(null);
    setSavedTo(null);
    setLoadingStep(0);
    intervalRef.current = setInterval(() => {
      setLoadingStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1));
    }, 2200);

    const started = await generateAiImageAction(eventId, prompt);

    if (!started.success) {
      stopAll();
      setError(started.error);
      return;
    }

    if (started.remaining !== null) setRemainingOverride(started.remaining);

    // Trigger the Netlify Background Function ourselves, from the
    // browser, rather than the Server Action doing a server-to-server
    // fetch (see the comment on generateAiImageAction for why that
    // approach kept failing). The URL is relative, so it always
    // resolves against whatever origin the admin is actually using — no
    // origin-detection logic needed on either side.
    //
    // Deliberately NOT using `keepalive: true` here, despite that being
    // the usual advice for "fire this and don't wait for it" requests —
    // keepalive requests share a combined 64KB budget (per the Fetch
    // spec) across every keepalive request in flight on the page,
    // including this site's Microsoft Clarity analytics beacons, and
    // Chrome fails them completely silently when that budget is
    // exceeded: no console error, no network entry, nothing — which is
    // exactly the "request never reaches the server, no visible error"
    // symptom this trigger kept producing. keepalive exists to survive
    // the *page unloading* mid-request, which isn't our situation: the
    // admin stays on this page the whole time watching the spinner, so
    // a plain fetch is both sufficient and avoids that failure mode
    // entirely.
    //
    // This is deliberately not awaited beyond firing it: the actual
    // OpenAI call runs out-of-band in the background function, and we
    // poll for its result below regardless of how the trigger itself
    // fares (the 3-minute server-side staleness check in
    // services/ai-image-jobs.ts and the poll ceiling below both cover
    // us if the trigger somehow doesn't land).
    fetch("/.netlify/functions/generate-ai-image-background", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: started.jobId, eventId, prompt }),
    }).catch((err) => {
      console.error("Failed to trigger AI image background function:", err);
    });

    pollCountRef.current = 0;
    pollRef.current = setInterval(async () => {
      pollCountRef.current += 1;

      const job = await getAiImageJobStatusAction(started.jobId);

      if (job.status === "done") {
        stopAll();
        if (job.resultUrl && job.resultPath) {
          setResult({ url: job.resultUrl, path: job.resultPath });
        } else {
          setError("Generation finished but no image was returned. Please try again.");
        }
      } else if (job.status === "error") {
        stopAll();
        setError(job.errorMessage || "Something went wrong generating the image.");
      } else if (pollCountRef.current >= MAX_POLLS) {
        // Backstop in case the server-side staleness check somehow
        // didn't catch it either — never leave the button stuck forever.
        stopAll();
        setError("This is taking much longer than expected. Please try again in a bit.");
      }
      // "pending" / "processing" / "not_found" (briefly, before the row
      // is visible) — keep polling.
    }, POLL_INTERVAL_MS);
  }

  async function handleUseAsShareImage() {
    if (!result) return;
    setBusy(true);
    const outcome = await confirmShareImageUploadAction(eventId, result.path);
    setBusy(false);
    if (outcome.success) {
      setSavedTo("share");
    } else {
      setError(outcome.error);
    }
  }

  async function handleAddToGallery() {
    if (!result) return;
    setBusy(true);
    const outcome = await confirmGalleryUploadAction(eventId, category, result.path, "AI-generated");
    setBusy(false);
    if (outcome.success) {
      setSavedTo("gallery");
    } else {
      setError(outcome.error);
    }
  }

  if (!configured) {
    return (
      <div className="rounded-xl border border-dashed border-navy-950/15 bg-white p-8 text-center">
        <Sparkles className="mx-auto text-navy-700/30" size={28} />
        <h3 className="mt-3 font-display text-lg text-navy-950">AI Image isn&rsquo;t set up yet</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-navy-700/60">
          Add an <code className="rounded bg-navy-950/5 px-1.5 py-0.5">OPENAI_API_KEY</code> to your
          environment to enable this. It calls OpenAI&rsquo;s image API, which is billed per image
          (roughly $0.02&ndash;$0.19 depending on quality) — see the README for setup steps and cost
          details.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="grid gap-4">
        <div>
          <label className="text-xs font-medium uppercase tracking-[0.15em] text-navy-700/70">
            Describe the image
          </label>
          <textarea
            className={`${inputClasses} mt-1.5 min-h-[160px] resize-y`}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. A royal gold birthday invitation with soft floral borders, elegant script, warm candlelight glow..."
          />
          <p className="mt-1.5 text-xs text-navy-700/50">
            Pre-filled with your event details — edit freely. Be specific about
            colors, mood, and motifs for the best result.
          </p>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={busy || !prompt.trim() || atLimit}
          size="lg"
          className="w-full sm:w-auto"
        >
          {busy ? (
            <>
              <Loader2 className="animate-spin" size={16} /> {LOADING_STEPS[loadingStep]}
            </>
          ) : (
            <>
              <Sparkles size={16} /> Generate Image
            </>
          )}
        </Button>

        {atLimit ? (
          <p className="text-sm text-amber-700">
            You&rsquo;ve used all {quota?.limit} AI image generations for this event. Contact
            your site admin to raise the limit.
          </p>
        ) : remaining !== null ? (
          <p className="text-xs text-navy-700/50">{remaining} generation{remaining === 1 ? "" : "s"} remaining.</p>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>

      <div>
        {result ? (
          <div className="grid gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={result.url}
              alt="AI-generated invitation"
              className="w-full rounded-xl border border-navy-950/10 object-cover"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <a href={result.url} download target="_blank" rel="noopener noreferrer">
                  <Download size={14} /> Download
                </a>
              </Button>
              <Button variant="outline" size="sm" onClick={handleUseAsShareImage} disabled={busy}>
                {savedTo === "share" ? <Check size={14} /> : <ImagePlus size={14} />}
                Use as Link Preview Image
              </Button>
              <div className="flex items-center gap-1.5">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as GalleryCategory)}
                  className="rounded-lg border border-navy-950/15 bg-white px-2 py-1.5 text-xs"
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <Button variant="outline" size="sm" onClick={handleAddToGallery} disabled={busy}>
                  {savedTo === "gallery" ? <Check size={14} /> : <ImagePlus size={14} />}
                  Add to Gallery
                </Button>
              </div>
            </div>
            {savedTo ? (
              <p className="text-xs text-green-700">
                Saved {savedTo === "share" ? "as your Link Preview Image" : "to Gallery"}.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="flex h-full min-h-[220px] items-center justify-center rounded-xl border border-dashed border-navy-950/15 text-sm text-navy-700/40">
            {busy ? "Generating..." : "Your generated image will appear here."}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Download, ImagePlus, Loader2, Sparkles, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  generateAiImageAction,
  requestAiImageUploadUrlAction,
  type StartAiImageResult,
  type RequestUploadUrlResult,
} from "@/features/admin/ai-image/actions";
import { confirmShareImageUploadAction, type AdminActionResult } from "@/features/admin/event-settings/actions";
import { confirmGalleryUploadAction } from "@/features/admin/gallery/actions";
import { GALLERY_CATEGORIES, type GalleryCategory } from "@/features/gallery/gallery-data";
import { supabaseBrowser } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image-compression";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

const LOADING_STEPS = [
  "Extracting event details...",
  "Designing the invitation...",
  "Enhancing details...",
  "Applying your theme...",
  "Still finishing up — this can take up to a minute...",
];

/**
 * Client-side ceiling on how long to wait for the Edge Function's
 * response before giving up — the function itself can run up to 150s
 * (free plan) / 400s (paid), but OpenAI's image API practically always
 * resolves well under a minute, so anything beyond this almost
 * certainly means something's actually stuck rather than just slow.
 */
const REQUEST_TIMEOUT_MS = 90_000;

const CATEGORY_OPTIONS = GALLERY_CATEGORIES.filter(
  (c): c is { value: GalleryCategory; label: string } => c.value !== "all",
);

/**
 * Every action this component needs, defaulting to the real admin
 * actions (getCurrentAdmin()-gated) — the self-serve onboarding wizard
 * (features/start/) overrides these with draft-token-gated equivalents
 * bound to a specific draft via .bind(null, token), since an anonymous
 * wizard visitor has no admin session. See features/start/draft-auth.ts.
 */
export interface AiImageActions {
  generate: (eventId: string, prompt: string) => Promise<StartAiImageResult>;
  requestUpload: (
    eventId: string,
    fileName: string,
    contentType: string,
    fileSize: number,
  ) => Promise<RequestUploadUrlResult>;
  useAsShareImage: (eventId: string, path: string) => Promise<AdminActionResult>;
  addToGallery: (
    eventId: string,
    category: GalleryCategory,
    path: string,
    caption: string,
  ) => Promise<AdminActionResult>;
}

const DEFAULT_ACTIONS: AiImageActions = {
  generate: generateAiImageAction,
  requestUpload: requestAiImageUploadUrlAction,
  useAsShareImage: confirmShareImageUploadAction,
  addToGallery: confirmGalleryUploadAction,
};

interface AiImageGeneratorProps {
  eventId: string;
  defaultPrompt: string;
  configured: boolean;
  /** Non-null only for client-role admins — owner has no cap. */
  quota: { used: number; limit: number } | null;
  /**
   * The most recently completed generation/upload for this event, if
   * any — fetched server-side via getLatestCompletedAiImageJob so the
   * preview panel isn't empty just because the admin reloaded the page
   * or came back later. See that function's doc comment for why this
   * was previously lost.
   */
  initialResult?: { url: string; path: string } | null;
  actions?: AiImageActions;
  /**
   * The wizard has no Supabase Auth session to send with the Edge
   * Function call — pass the anon key instead of a session token in
   * that case. The Edge Function's real authorization is the job's
   * jobId/eventId match (see supabase/functions/generate-ai-image),
   * not this header; verify_jwt just needs *a* valid Supabase-signed
   * JWT, and the anon key qualifies. Admin dashboard usage (the
   * default, anonAuthKey undefined) keeps sending the signed-in
   * admin's own session token, unchanged.
   */
  anonAuthKey?: string;
}

export function AiImageGenerator({
  eventId,
  defaultPrompt,
  configured,
  quota,
  initialResult = null,
  actions = DEFAULT_ACTIONS,
  anonAuthKey,
}: AiImageGeneratorProps) {
  const [mode, setMode] = useState<"generate" | "upload">("generate");
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [busy, setBusy] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; path: string } | null>(initialResult);
  const [category, setCategory] = useState<GalleryCategory>("family");
  const [savedTo, setSavedTo] = useState<"share" | "gallery" | null>(null);
  const [remainingOverride, setRemainingOverride] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const remaining = remainingOverride ?? (quota ? quota.limit - quota.used : null);
  const atLimit = remaining !== null && remaining <= 0;

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function stopLoadingSteps() {
    if (intervalRef.current) clearInterval(intervalRef.current);
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

    const started = await actions.generate(eventId, prompt);

    if (!started.success) {
      stopLoadingSteps();
      setError(started.error);
      return;
    }

    if (started.remaining !== null) setRemainingOverride(started.remaining);

    // Call the Supabase Edge Function directly and await the real
    // result — see the comment on generateAiImageAction for why this
    // replaced an earlier trigger-and-poll design built around a
    // Netlify Background Function. Edge Functions get up to 150s (free
    // plan) of wall-clock time per request, comfortably more than
    // OpenAI's usual 30-60s, so the whole thing — OpenAI call, Storage
    // upload, job row update — happens inside this one request/response
    // instead of needing to be triggered separately and polled for.
    //
    // Sends the admin's own Supabase session token in the Authorization
    // header when there is one (the Edge Function has JWT verification
    // enabled) — falls back to anonAuthKey for the wizard's anonymous
    // visitors, since verify_jwt only needs *a* valid Supabase-signed
    // JWT, and the real per-request authorization is the job's
    // jobId/eventId match done inside the function itself either way.
    try {
      const {
        data: { session },
      } = await supabaseBrowser().auth.getSession();

      const authToken = session?.access_token ?? anonAuthKey;
      if (!authToken) {
        stopLoadingSteps();
        setError("Your session has expired — please sign in again.");
        return;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-ai-image`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ jobId: started.jobId, eventId, prompt }),
          signal: controller.signal,
        },
      );
      clearTimeout(timeout);

      const outcome: { success: boolean; error?: string; resultUrl?: string; resultPath?: string } =
        await res.json();

      stopLoadingSteps();

      if (!outcome.success || !outcome.resultUrl || !outcome.resultPath) {
        setError(outcome.error || "Something went wrong generating the image.");
        return;
      }

      setResult({ url: outcome.resultUrl, path: outcome.resultPath });
    } catch (err) {
      stopLoadingSteps();
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("This is taking much longer than expected. Please try again in a bit.");
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong generating the image.");
      }
    }
  }

  async function handleUpload(file: File) {
    setBusy(true);
    setError(null);
    setResult(null);
    setSavedTo(null);

    try {
      const compressed = await compressImage(file);
      const signed = await actions.requestUpload(eventId, compressed.name, compressed.type, compressed.size);
      if (!signed.success) throw new Error(signed.error);

      const { bucket, path, token } = signed.data;
      const { error: uploadError } = await supabaseBrowser()
        .storage.from(bucket)
        .uploadToSignedUrl(path, token, compressed);
      if (uploadError) throw new Error(uploadError.message);

      const { data } = supabaseBrowser().storage.from(bucket).getPublicUrl(path);
      setResult({ url: data.publicUrl, path });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUseAsShareImage() {
    if (!result) return;
    setBusy(true);
    const outcome = await actions.useAsShareImage(eventId, result.path);
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
    const outcome = await actions.addToGallery(eventId, category, result.path, "AI-generated");
    setBusy(false);
    if (outcome.success) {
      setSavedTo("gallery");
    } else {
      setError(outcome.error);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="grid gap-4">
        <div className="inline-flex w-fit rounded-full border border-navy-950/10 bg-navy-950/[0.03] p-1">
          <button
            type="button"
            onClick={() => setMode("generate")}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-luxury duration-200 ${
              mode === "generate" ? "bg-white text-navy-950 shadow-sm" : "text-navy-700/60"
            }`}
          >
            <Sparkles size={13} /> Generate with AI
          </button>
          <button
            type="button"
            onClick={() => setMode("upload")}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-luxury duration-200 ${
              mode === "upload" ? "bg-white text-navy-950 shadow-sm" : "text-navy-700/60"
            }`}
          >
            <Upload size={13} /> Upload Your Own
          </button>
        </div>

        {mode === "generate" ? (
          !configured ? (
            <div className="rounded-xl border border-dashed border-navy-950/15 bg-white p-8 text-center">
              <Sparkles className="mx-auto text-navy-700/30" size={28} />
              <h3 className="mt-3 font-display text-lg text-navy-950">AI Image isn&rsquo;t set up yet</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-navy-700/60">
                Add an <code className="rounded bg-navy-950/5 px-1.5 py-0.5">OPENAI_API_KEY</code> to
                your environment to enable this, or use the &ldquo;Upload Your Own&rdquo; tab instead —
                no API key needed for that.
              </p>
            </div>
          ) : (
            <>
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
                <p className="text-xs text-navy-700/50">
                  {remaining} generation{remaining === 1 ? "" : "s"} remaining.
                </p>
              ) : null}
            </>
          )
        ) : (
          <div>
            <label className="text-xs font-medium uppercase tracking-[0.15em] text-navy-700/70">
              Upload an image
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
              className="mt-1.5 flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-navy-950/20 bg-navy-950/[0.02] px-6 py-10 text-center hover:border-gold-500/50 disabled:cursor-wait"
            >
              {busy ? (
                <Loader2 className="animate-spin text-navy-700/50" size={22} />
              ) : (
                <Upload className="text-navy-700/40" size={22} />
              )}
              <span className="text-sm text-navy-700/70">
                {busy ? "Uploading..." : "Tap to choose a photo"}
              </span>
              <span className="text-xs text-navy-700/40">JPEG, PNG, WEBP, or HEIC — up to 50MB</span>
            </button>
            <p className="mt-1.5 text-xs text-navy-700/50">
              Already have an invitation design? Upload it here instead of generating one — it&rsquo;s
              treated exactly the same afterward (download, use as Link Preview, or add to Gallery).
            </p>
          </div>
        )}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>

      <div>
        {result ? (
          <div className="grid gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={result.url}
              alt="Invitation"
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
            {busy
              ? mode === "upload"
                ? "Uploading..."
                : "Generating..."
              : "Your image will appear here."}
          </div>
        )}
      </div>
    </div>
  );
}

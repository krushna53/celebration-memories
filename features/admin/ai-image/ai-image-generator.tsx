"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Download, ImagePlus, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { generateAiImageAction } from "@/features/admin/ai-image/actions";
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
  "Final rendering...",
];

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

  const remaining = remainingOverride ?? (quota ? quota.limit - quota.used : null);
  const atLimit = remaining !== null && remaining <= 0;

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  async function handleGenerate() {
    setBusy(true);
    setError(null);
    setResult(null);
    setSavedTo(null);
    setLoadingStep(0);
    intervalRef.current = setInterval(() => {
      setLoadingStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1));
    }, 2200);

    const outcome = await generateAiImageAction(eventId, prompt);

    if (intervalRef.current) clearInterval(intervalRef.current);
    setBusy(false);

    if (outcome.success) {
      setResult({ url: outcome.url, path: outcome.path });
      if (outcome.remaining !== null) setRemainingOverride(outcome.remaining);
    } else {
      setError(outcome.error);
    }
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

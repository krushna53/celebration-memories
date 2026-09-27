"use client";

import { useState } from "react";
import Image from "next/image";
import { Check, Loader2, Sparkles, X } from "lucide-react";

import { GALLERY_CATEGORIES, type GalleryCategory } from "@/features/gallery/gallery-data";
import type { GalleryPhotoRecord } from "@/types/content";
import { applyGalleryTagSuggestionsAction, suggestGalleryTagsAction } from "@/features/admin/gallery/actions";

const CATEGORY_OPTIONS = GALLERY_CATEGORIES.filter(
  (c): c is { value: GalleryCategory; label: string } => c.value !== "all",
);
/** Photos analysed at once — enough to be quick, few enough to stay polite to the AI API. */
const PARALLEL = 3;

interface Suggestion {
  photo: GalleryPhotoRecord;
  category: GalleryCategory;
  caption: string;
  include: boolean;
  error?: string;
}

/**
 * "Suggest with AI" for the admin gallery: asks the AI for a category +
 * caption per photo (lib/ai-gallery-tagger.ts), shows every suggestion
 * for review/editing, and saves only what the admin approves. By default
 * it only looks at photos without a caption, so re-running never
 * overwrites captions someone already wrote.
 */
export function GalleryAiTagger({ eventId, photos }: { eventId: string; photos: GalleryPhotoRecord[] }) {
  const [includeCaptioned, setIncludeCaptioned] = useState(false);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const targets = photos.filter((p) => includeCaptioned || !p.caption?.trim());

  async function run() {
    setRunning(true);
    setDone(0);
    setMessage(null);
    const results: Suggestion[] = targets.map((photo) => ({ photo, category: photo.category, caption: photo.caption ?? "", include: false }));
    setSuggestions([...results]);

    let next = 0;
    async function worker() {
      while (next < targets.length) {
        const i = next++;
        const photo = targets[i]!;
        const result = await suggestGalleryTagsAction(photo.id);
        results[i] = result.success
          ? { photo, category: result.data.category, caption: result.data.caption, include: true }
          : { photo, category: photo.category, caption: photo.caption ?? "", include: false, error: result.error };
        setSuggestions([...results]);
        setDone((d) => d + 1);
      }
    }
    await Promise.all(Array.from({ length: Math.min(PARALLEL, targets.length) }, worker));
    setRunning(false);
  }

  function update(i: number, patch: Partial<Suggestion>) {
    setSuggestions((prev) => prev?.map((s, j) => (j === i ? { ...s, ...patch } : s)) ?? null);
  }

  async function apply() {
    if (!suggestions) return;
    const chosen = suggestions.filter((s) => s.include && !s.error);
    setApplying(true);
    const result = await applyGalleryTagSuggestionsAction(
      eventId,
      chosen.map((s) => ({ id: s.photo.id, category: s.category, caption: s.caption })),
    );
    setApplying(false);
    if (!result.success) {
      setMessage(result.error);
      return;
    }
    setMessage(`Saved ${result.data.applied} photo${result.data.applied === 1 ? "" : "s"}.`);
    window.location.reload();
  }

  const chosenCount = suggestions?.filter((s) => s.include && !s.error).length ?? 0;

  return (
    <div className="mt-6 rounded-xl border border-navy-950/10 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium text-navy-950">
            <Sparkles size={15} className="text-gold-600" /> Sort & caption with AI
          </p>
          <p className="mt-0.5 text-xs text-navy-700/60">
            AI suggests a category and a short caption for each photo. Nothing is saved until you review and apply.
            It never guesses names.
          </p>
        </div>
        {!suggestions ? (
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-navy-700/70">
              <input type="checkbox" checked={includeCaptioned} onChange={(e) => setIncludeCaptioned(e.target.checked)} />
              Include photos that already have captions
            </label>
            <button
              type="button"
              onClick={run}
              disabled={targets.length === 0}
              className="flex items-center gap-2 rounded-lg bg-navy-950 px-4 py-2 text-sm font-medium text-ivory-50 disabled:opacity-50"
            >
              <Sparkles size={15} /> Suggest for {targets.length} photo{targets.length === 1 ? "" : "s"}
            </button>
          </div>
        ) : null}
      </div>

      {suggestions ? (
        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-navy-700/70">
              {running ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 size={13} className="animate-spin" /> Analysing {done} of {suggestions.length}…
                </span>
              ) : (
                `Review ${suggestions.length} suggestion${suggestions.length === 1 ? "" : "s"} — edit anything, untick what you don't want.`
              )}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSuggestions(null)}
                disabled={running || applying}
                className="flex items-center gap-1 rounded-lg border border-navy-950/15 px-3 py-1.5 text-xs text-navy-700 disabled:opacity-50"
              >
                <X size={13} /> Discard
              </button>
              <button
                type="button"
                onClick={apply}
                disabled={running || applying || chosenCount === 0}
                className="flex items-center gap-1.5 rounded-lg bg-gold-500 px-3 py-1.5 text-xs font-medium text-navy-950 disabled:opacity-50"
              >
                {applying ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Apply {chosenCount}
              </button>
            </div>
          </div>
          {message ? <p className="mt-2 text-xs text-navy-700">{message}</p> : null}

          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {suggestions.map((s, i) => (
              <li key={s.photo.id} className="flex gap-3 rounded-lg border border-navy-950/10 p-2">
                <Image
                  src={s.photo.url}
                  alt=""
                  width={72}
                  height={72}
                  className="h-[72px] w-[72px] shrink-0 rounded object-cover"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  {s.error ? (
                    <p className="text-xs text-red-600">{s.error}</p>
                  ) : running && !s.include ? (
                    <p className="flex items-center gap-1 text-xs text-navy-700/50">
                      <Loader2 size={12} className="animate-spin" /> Waiting…
                    </p>
                  ) : (
                    <>
                      <select
                        value={s.category}
                        onChange={(e) => update(i, { category: e.target.value as GalleryCategory })}
                        className="rounded border border-navy-950/15 bg-white px-2 py-1 text-xs"
                        aria-label="Category"
                      >
                        {CATEGORY_OPTIONS.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                      <input
                        value={s.caption}
                        onChange={(e) => update(i, { caption: e.target.value })}
                        maxLength={200}
                        className="rounded border border-navy-950/15 bg-white px-2 py-1 text-xs"
                        aria-label="Caption"
                      />
                      <label className="flex items-center gap-1.5 text-[11px] text-navy-700/70">
                        <input type="checkbox" checked={s.include} onChange={(e) => update(i, { include: e.target.checked })} />
                        Apply this one
                      </label>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

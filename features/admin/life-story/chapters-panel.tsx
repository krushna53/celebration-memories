"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { LifeStoryBundle, LifeStoryChapter } from "@/types/life-story";
import { getWritingStatusAction, saveChaptersAction, startWritingAction, updatePhotoAction } from "@/features/admin/life-story/actions";
import { DownloadBookButton } from "@/features/life-story/download-book-button";
import { card, errorText, hint, input, label } from "@/features/admin/life-story/styles";

type EditableChapter = Omit<LifeStoryChapter, "sortOrder">;

/**
 * Step 3 — the written biography. "Write with AI" hands the story and
 * photos to the life-story Edge Function (background job, polled here);
 * it also drafts the film script used in step 4. Everything it writes is
 * editable, and regenerating replaces chapters and script wholesale, so
 * that asks first once there's something to lose.
 */
export function ChaptersPanel({
  eventId,
  bundle,
  writesLeft,
  aiConfigured,
}: {
  eventId: string;
  bundle: LifeStoryBundle;
  writesLeft: number | null;
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const [chapters, setChapters] = useState<EditableChapter[]>(bundle.chapters);
  const [photos, setPhotos] = useState(bundle.photos);
  const [status, setStatus] = useState(bundle.story.structureStatus);
  const [error, setError] = useState<string | null>(bundle.story.structureStatus === "error" ? bundle.story.structureError : null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Poll while the AI is writing; refresh the page data once it's done.
  useEffect(() => {
    if (status !== "processing") return;
    const timer = setInterval(async () => {
      const res = await getWritingStatusAction(eventId);
      if (!res.success || res.data.structureStatus === "processing") return;
      setStatus(res.data.structureStatus);
      if (res.data.structureStatus === "error") setError(res.data.structureError ?? "The AI couldn't write this story.");
      router.refresh();
    }, 4000);
    return () => clearInterval(timer);
  }, [status, eventId, router]);

  async function write() {
    if (chapters.length && !window.confirm("Rewrite with AI? This replaces the current chapters and film script with a fresh draft.")) return;
    setError(null);
    const res = await startWritingAction(eventId);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setStatus("processing");
  }

  const update = (index: number, values: Partial<EditableChapter>) => {
    setChapters((list) => list.map((c, i) => (i === index ? { ...c, ...values } : c)));
    setDirty(true);
  };
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= chapters.length) return;
    const next = [...chapters];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setChapters(next);
    setDirty(true);
  };

  async function save() {
    setSaving(true);
    setError(null);
    const res = await saveChaptersAction(eventId, chapters);
    setSaving(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setDirty(false);
    router.refresh();
  }

  async function assignPhoto(photoId: string, chapterId: string | null) {
    setPhotos((list) => list.map((p) => (p.id === photoId ? { ...p, chapterId } : p)));
    const res = await updatePhotoAction(eventId, photoId, { chapterId });
    if (!res.success) setError(res.error);
  }

  const savedChapterIds = new Set(bundle.chapters.map((c) => c.id));
  const tooShort = bundle.story.storyText.trim().length < 200;

  return (
    <div className="space-y-6">
      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="max-w-xl">
            <h2 className="font-display text-lg text-navy-950">Biography</h2>
            <p className={hint}>
              The AI reads the story, looks at every photo, and writes chapters, photo captions and a film script — using only what
              the family wrote. Edit anything afterwards.
            </p>
            {writesLeft !== null ? <p className={`mt-1 ${hint}`}>{writesLeft} AI writing run(s) left for this event.</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={write} disabled={status === "processing" || !aiConfigured || tooShort || writesLeft === 0}>
              {status === "processing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {status === "processing" ? "Writing… (about a minute)" : chapters.length ? "Rewrite with AI" : "Write with AI"}
            </Button>
            {chapters.length ? <DownloadBookButton bundle={bundle} /> : null}
          </div>
        </div>
        {!aiConfigured ? <p className={`mt-3 ${hint}`}>AI writing isn&apos;t configured on this site yet — you can still write chapters by hand below.</p> : null}
        {tooShort ? <p className={`mt-3 ${hint}`}>Add the story in step 1 first.</p> : null}
        {error ? <p className={`mt-3 ${errorText}`}>{error}</p> : null}
      </section>

      {chapters.map((chapter, i) => {
        const chapterPhotos = photos.filter((p) => p.chapterId === chapter.id);
        return (
          <section key={chapter.id} className={card}>
            <div className="flex flex-wrap items-start gap-3">
              <div className="grid flex-1 gap-3 sm:grid-cols-[1fr_180px]">
                <div>
                  <label className={label} htmlFor={`ch-title-${chapter.id}`}>
                    Chapter {i + 1}
                  </label>
                  <input id={`ch-title-${chapter.id}`} className={`mt-1 font-display ${input}`} value={chapter.title} onChange={(e) => update(i, { title: e.target.value })} />
                </div>
                <div>
                  <label className={label} htmlFor={`ch-period-${chapter.id}`}>
                    Period
                  </label>
                  <input id={`ch-period-${chapter.id}`} className={`mt-1 ${input}`} value={chapter.period} onChange={(e) => update(i, { period: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-1 pt-5">
                <button type="button" aria-label="Move chapter up" onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1.5 text-navy-700/60 hover:bg-ivory-100 disabled:opacity-30">
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Move chapter down"
                  onClick={() => move(i, 1)}
                  disabled={i === chapters.length - 1}
                  className="rounded p-1.5 text-navy-700/60 hover:bg-ivory-100 disabled:opacity-30"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Delete chapter"
                  onClick={() => {
                    if (!window.confirm(`Delete "${chapter.title}"?`)) return;
                    setChapters((list) => list.filter((_, j) => j !== i));
                    setDirty(true);
                  }}
                  className="rounded p-1.5 text-red-700/70 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <label className="sr-only" htmlFor={`ch-body-${chapter.id}`}>
              Chapter text
            </label>
            <textarea
              id={`ch-body-${chapter.id}`}
              rows={10}
              className={`mt-3 font-serif leading-relaxed ${input}`}
              value={chapter.body}
              onChange={(e) => update(i, { body: e.target.value })}
            />
            <p className={`mt-1 ${hint}`}>Leave a blank line between paragraphs.</p>

            {savedChapterIds.has(chapter.id) ? (
              <div className="mt-4">
                <p className={label}>Photos in this chapter</p>
                {chapterPhotos.length === 0 ? <p className={`mt-1 ${hint}`}>None yet — assign one below.</p> : null}
                <ul className="mt-2 flex flex-wrap gap-2">
                  {chapterPhotos.map((p) => (
                    <li key={p.id} className="w-24">
                      <img src={p.url} alt={p.caption || "Photo"} className="h-16 w-24 rounded object-cover" loading="lazy" />
                      <button type="button" onClick={() => assignPhoto(p.id, null)} className="mt-0.5 text-[11px] text-navy-700/60 underline">
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
                {photos.some((p) => !p.chapterId) ? (
                  <select
                    aria-label="Add a photo to this chapter"
                    className={`mt-2 max-w-xs ${input}`}
                    value=""
                    onChange={(e) => e.target.value && assignPhoto(e.target.value, chapter.id)}
                  >
                    <option value="">+ Add an unplaced photo…</option>
                    {photos
                      .filter((p) => !p.chapterId)
                      .map((p, n) => (
                        <option key={p.id} value={p.id}>
                          {p.caption || `Photo ${n + 1}`}
                          {p.yearLabel ? ` (${p.yearLabel})` : ""}
                        </option>
                      ))}
                  </select>
                ) : null}
              </div>
            ) : (
              <p className={`mt-3 ${hint}`}>Save to add photos to this new chapter.</p>
            )}
          </section>
        );
      })}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setChapters((list) => [...list, { id: crypto.randomUUID(), title: "New chapter", period: "", body: "" }]);
            setDirty(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Add chapter
        </Button>
        {chapters.length || dirty ? (
          <Button type="button" onClick={save} disabled={saving || !dirty}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {dirty ? "Save chapters" : "Saved"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

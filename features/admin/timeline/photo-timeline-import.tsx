"use client";

import { useEffect, useRef, useState } from "react";
import { FolderArchive, Loader2, Scissors, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  MAX_GROUPS,
  defaultCover,
  groupDateLabel,
  groupLocation,
  groupPeriod,
  groupPhotos,
  makeThumbnailDataUrl,
  mapLimited,
  periodYear,
  readPhotos,
  type ImportedPhoto,
  type PhotoGroup,
} from "@/features/admin/timeline/photo-import";
import type { TimelineActions } from "@/features/admin/timeline/timeline-manager";
import type { TimelinePhotoGroupInput } from "@/types/timeline-import";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

const ACCEPT = ".zip,application/zip,application/x-zip-compressed,image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";
/** Splitting a big group into one milestone per photo only makes sense for a handful of photos. */
const MAX_SPLIT = 12;
/** Strip of cover choices shown per draft. */
const STRIP_SIZE = 12;

interface Draft {
  id: string;
  photos: ImportedPhoto[];
  coverId: string;
  include: boolean;
  period: string;
  title: string;
  description: string;
  dateLabel: string | null;
  place: string | null;
}

type Phase =
  | { kind: "idle" }
  | { kind: "working"; message: string }
  | { kind: "review" }
  | { kind: "saving"; done: number; total: number };

interface PhotoTimelineImportProps {
  eventId: string;
  existingCount: number;
  actions: Pick<TimelineActions, "createMilestone" | "describePlace" | "suggestFromPhotos">;
  /** TimelineManager's own compress → signed upload → attach, so imported photos are stored exactly like hand-added ones. */
  uploadToMilestone: (milestoneId: string, file: File) => Promise<void>;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The words used when the AI isn't available — plain facts from the files. */
function fallbackText(draft: Pick<Draft, "dateLabel" | "place" | "photos">) {
  const town = draft.place?.split(",")[0];
  const title = town ? `In ${town}` : draft.dateLabel ? `Photos from ${draft.dateLabel}` : "";
  const facts = [draft.place ? `in ${draft.place}` : null, draft.dateLabel ? `on ${draft.dateLabel}` : null].filter(Boolean);
  return { title, description: facts.length ? `Taken ${facts.join(" ")}.` : "" };
}

/** Oldest first: the year in the (possibly AI-estimated) period wins over a scan's file date; undated-and-unguessable last. */
function sortDrafts(drafts: Draft[]): Draft[] {
  const key = (d: Draft) => {
    const year = periodYear(d.period);
    const firstTaken = d.photos.find((p) => p.takenAt)?.takenAt;
    return { year: year ?? (firstTaken ? Number(firstTaken.slice(0, 4)) : Infinity), at: firstTaken ?? "" };
  };
  return [...drafts].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    return ka.year - kb.year || ka.at.localeCompare(kb.at);
  });
}

export function PhotoTimelineImport({ eventId, existingCount, actions, uploadToMilestone }: PhotoTimelineImportProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [rewritingId, setRewritingId] = useState<string | null>(null);
  // Object URLs for every imported photo, keyed by photo id — revoked when the import closes.
  const [previews, setPreviews] = useState<Map<string, string>>(new Map());
  const previewsRef = useRef(previews);
  previewsRef.current = previews;
  // Place names per rounded GPS position, so a re-split never geocodes the same spot twice.
  const placeCache = useRef(new Map<string, string | null>());

  useEffect(() => () => previewsRef.current.forEach((url) => URL.revokeObjectURL(url)), []);

  function reset() {
    previews.forEach((url) => URL.revokeObjectURL(url));
    setPreviews(new Map());
    setDrafts([]);
    setNotice(null);
    setPhase({ kind: "idle" });
  }

  /** Reverse-geocodes each group once. Sequential with a pause — the free geocoder allows ~1 request a second. */
  async function placesFor(groups: PhotoGroup[], onProgress: (done: number) => void): Promise<(string | null)[]> {
    const places: (string | null)[] = [];
    let first = true;
    for (const group of groups) {
      const loc = groupLocation(group);
      if (!loc) {
        places.push(null);
      } else {
        const key = `${loc.lat.toFixed(2)},${loc.lon.toFixed(2)}`;
        if (!placeCache.current.has(key)) {
          if (!first) await sleep(1100);
          first = false;
          const result = await actions.describePlace(eventId, loc.lat, loc.lon).catch(() => null);
          placeCache.current.set(key, result?.success ? result.data.place : null);
        }
        places.push(placeCache.current.get(key) ?? null);
      }
      onProgress(places.length);
    }
    return places;
  }

  /**
   * Fills title/description/period for `targets` with one AI call (cover
   * thumbnails only). Falls back to plain facts for any it can't do, and
   * says why in the notice — the drafts are always usable either way.
   */
  async function writeWithAi(targets: Draft[]): Promise<{ drafts: Draft[]; aiOk: boolean }> {
    const thumbs = await mapLimited(targets, 3, (d) => {
      const cover = d.photos.find((p) => p.id === d.coverId) ?? d.photos[0];
      return cover ? makeThumbnailDataUrl(cover.file).catch(() => null) : Promise.resolve(null);
    });
    const withThumb = targets
      .map((draft, i) => ({ draft, thumb: thumbs[i] }))
      .filter((x): x is { draft: Draft; thumb: string } => typeof x.thumb === "string" && x.thumb.length < 140_000);

    const written = new Map<string, Pick<Draft, "period" | "title" | "description">>();
    if (withThumb.length > 0) {
      const groups: TimelinePhotoGroupInput[] = withThumb.map(({ draft, thumb }) => ({
        period: groupPeriod({ id: draft.id, photos: draft.photos }),
        dateLabel: draft.dateLabel,
        place: draft.place,
        photoCount: draft.photos.length,
        imageDataUrl: thumb,
      }));
      const result = await actions.suggestFromPhotos(eventId, groups).catch(() => null);
      if (result?.success) {
        result.data.suggestions.forEach((s, i) => {
          const draft = withThumb[i]?.draft;
          if (draft && s.title) written.set(draft.id, s);
        });
      } else {
        setNotice(
          `${result?.error ?? "AI writing failed."} We've filled in the dates and places from the photos instead — edit the titles below.`,
        );
      }
    }

    const drafts = targets.map((draft) => {
      const ai = written.get(draft.id);
      if (ai) return { ...draft, period: ai.period || draft.period, title: ai.title, description: ai.description };
      const plain = fallbackText(draft);
      return { ...draft, title: draft.title || plain.title, description: draft.description || plain.description };
    });
    return { drafts, aiOk: written.size > 0 };
  }

  async function buildDrafts(groups: PhotoGroup[], onPlaceProgress: (done: number) => void): Promise<Draft[]> {
    const places = await placesFor(groups, onPlaceProgress);
    return groups.map((group, i) => {
      const cover = defaultCover(group);
      return {
        id: group.id,
        photos: group.photos,
        coverId: cover?.id ?? "",
        include: true,
        period: groupPeriod(group) ?? "",
        title: "",
        description: "",
        dateLabel: groupDateLabel(group),
        place: places[i] ?? null,
      };
    });
  }

  async function handleFiles(picked: File[]) {
    if (picked.length === 0) return;
    setNotice(null);
    setPhase({ kind: "working", message: "Opening your photos…" });
    try {
      const { photos, skipped, overLimit } = await readPhotos(picked, (done, total) =>
        setPhase({ kind: "working", message: `Reading dates and places… ${done} of ${total}` }),
      );
      if (photos.length === 0) {
        setNotice("We couldn't find any photos in that — use JPEG, PNG, WebP or HEIC files, or a .zip of them.");
        setPhase({ kind: "idle" });
        return;
      }

      const urls = new Map<string, string>();
      photos.forEach((p) => urls.set(p.id, URL.createObjectURL(p.file)));
      setPreviews(urls);

      const groups = groupPhotos(photos);
      let drafts = await buildDrafts(groups, (done) =>
        setPhase({ kind: "working", message: `Finding where they were taken… ${done} of ${groups.length}` }),
      );
      setPhase({ kind: "working", message: `Writing ${groups.length} milestone${groups.length === 1 ? "" : "s"} with AI…` });
      const written = await writeWithAi(drafts);
      drafts = sortDrafts(written.drafts);

      const undated = photos.filter((p) => !p.takenAt).length;
      const notes = [
        `${photos.length} photo${photos.length === 1 ? "" : "s"} → ${drafts.length} milestone${drafts.length === 1 ? "" : "s"}.`,
        undated
          ? `${undated} had no date${written.aiOk ? " — the AI guessed their decade from the picture, so check those" : " — add a period for those yourself"}.`
          : null,
        overLimit ? `${overLimit} more were left out (limit is ${photos.length} per import).` : null,
        skipped ? `${skipped} non-photo file${skipped === 1 ? "" : "s"} skipped.` : null,
      ].filter(Boolean);
      setNotice((prev) => (prev ? `${prev} ${notes.join(" ")}` : notes.join(" ")));
      setDrafts(drafts);
      setPhase({ kind: "review" });
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Couldn't read those photos.");
      setPhase({ kind: "idle" });
    }
  }

  function update(id: string, patch: Partial<Draft>) {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  /** One group → one milestone per photo (e.g. a pile of scans that all share the day they were scanned). */
  async function split(draft: Draft) {
    setRewritingId(draft.id);
    const groups = draft.photos.map((photo) => ({ id: `${draft.id}-${photo.id}`, photos: [photo] }));
    const { drafts: pieces } = await writeWithAi(await buildDrafts(groups, () => undefined));
    setDrafts((prev) => sortDrafts([...prev.filter((d) => d.id !== draft.id), ...pieces]));
    setRewritingId(null);
  }

  async function rewrite(draft: Draft) {
    setRewritingId(draft.id);
    const {
      drafts: [updated],
    } = await writeWithAi([{ ...draft, title: "", description: "" }]);
    if (updated) update(draft.id, { period: updated.period, title: updated.title, description: updated.description });
    setRewritingId(null);
  }

  async function save() {
    const chosen = drafts.filter((d) => d.include);
    const incomplete = chosen.find((d) => !d.period.trim() || !d.title.trim() || !d.description.trim());
    if (incomplete) {
      alert(`Every milestone needs a period, title and description — “${incomplete.title || incomplete.period || "one of them"}” is missing something.`);
      return;
    }
    const failures: string[] = [];
    for (const [i, draft] of chosen.entries()) {
      setPhase({ kind: "saving", done: i, total: chosen.length });
      const created = await actions.createMilestone({
        eventId,
        period: draft.period.trim(),
        title: draft.title.trim(),
        description: draft.description.trim(),
        sortOrder: existingCount + i,
      });
      if (!created.success) {
        failures.push(`${draft.title}: ${created.error}`);
        continue;
      }
      const cover = draft.photos.find((p) => p.id === draft.coverId) ?? draft.photos[0];
      if (cover) {
        await uploadToMilestone(created.data.id, cover.file).catch((err: unknown) =>
          failures.push(`${draft.title} (photo): ${err instanceof Error ? err.message : "upload failed"}`),
        );
      }
    }
    if (failures.length) alert(`Some milestones didn't save completely:\n\n${failures.join("\n")}`);
    window.location.reload();
  }

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      multiple
      accept={ACCEPT}
      className="hidden"
      onChange={(e) => {
        const files = Array.from(e.target.files ?? []);
        e.target.value = "";
        void handleFiles(files);
      }}
    />
  );

  if (phase.kind === "idle" || phase.kind === "working") {
    const working = phase.kind === "working";
    return (
      <div className="mb-4 rounded-xl border border-dashed border-gold-500/40 bg-white p-4">
        {fileInput}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" size="sm" disabled={working} onClick={() => inputRef.current?.click()}>
            {working ? <Loader2 className="animate-spin" size={13} /> : <FolderArchive size={13} />}
            Build from a zip of photos
          </Button>
          <p className="min-w-0 flex-1 text-xs text-navy-700/60" aria-live="polite">
            {working
              ? phase.message
              : `Upload a .zip (or pick many photos). We'll group them by when and where they were taken, and AI writes each milestone — up to ${MAX_GROUPS} at a time. You review everything before it's added.`}
          </p>
        </div>
        {notice ? <p className="mt-2 text-xs text-red-700">{notice}</p> : null}
      </div>
    );
  }

  const chosenCount = drafts.filter((d) => d.include).length;
  const saving = phase.kind === "saving";

  return (
    <section aria-label="Review imported milestones" className="mb-6 rounded-xl border border-gold-500/30 bg-white p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg text-navy-950">Review your new milestones</h3>
          <p className="text-xs text-navy-700/60">
            Untick any you don&rsquo;t want, tap a photo to make it the milestone&rsquo;s picture, and edit the words freely. They&rsquo;re added after your
            existing milestones — reorder afterwards with the arrows.
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          disabled={saving}
          aria-label="Cancel import"
          className="tap-target flex shrink-0 items-center justify-center text-navy-700/50 hover:text-red-600"
        >
          <X size={18} />
        </button>
      </div>
      {notice ? <p className="mb-3 rounded-lg bg-gold-500/10 p-2 text-xs text-navy-700/80">{notice}</p> : null}

      <ol className="space-y-3">
        {drafts.map((draft) => {
          const cover = draft.photos.find((p) => p.id === draft.coverId) ?? draft.photos[0];
          const busy = rewritingId === draft.id;
          return (
            <li
              key={draft.id}
              className={`rounded-lg border p-3 transition-opacity ${draft.include ? "border-gold-500/30" : "border-navy-950/10 opacity-50"}`}
            >
              <div className="flex gap-3">
                <label className="flex shrink-0 cursor-pointer flex-col items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.include}
                    onChange={(e) => update(draft.id, { include: e.target.checked })}
                    className="h-4 w-4 accent-gold-600"
                    aria-label={`Include “${draft.title || draft.period}”`}
                  />
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previews.get(cover.id)} alt="" className="h-20 w-20 rounded object-cover sm:h-24 sm:w-24" />
                  ) : null}
                </label>

                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-xs text-navy-700/60">
                    {[draft.dateLabel ?? "No date in the files", draft.place, `${draft.photos.length} photo${draft.photos.length === 1 ? "" : "s"}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
                    <input
                      className={inputClasses}
                      placeholder="Period"
                      aria-label="Period"
                      value={draft.period}
                      onChange={(e) => update(draft.id, { period: e.target.value })}
                    />
                    <input
                      className={inputClasses}
                      placeholder="Title"
                      aria-label="Title"
                      value={draft.title}
                      onChange={(e) => update(draft.id, { title: e.target.value })}
                    />
                  </div>
                  <textarea
                    className={inputClasses}
                    rows={2}
                    placeholder="Description"
                    aria-label="Description"
                    value={draft.description}
                    onChange={(e) => update(draft.id, { description: e.target.value })}
                  />

                  {draft.photos.length > 1 ? (
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Choose the milestone's photo">
                      {draft.photos.slice(0, STRIP_SIZE).map((photo) => (
                        <button
                          key={photo.id}
                          type="button"
                          onClick={() => update(draft.id, { coverId: photo.id })}
                          aria-pressed={photo.id === cover?.id}
                          aria-label={`Use ${photo.file.name} as the photo`}
                          className={`h-10 w-10 overflow-hidden rounded ${photo.id === cover?.id ? "ring-2 ring-gold-500" : "opacity-70 hover:opacity-100"}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={previews.get(photo.id)} alt="" loading="lazy" className="h-full w-full object-cover" />
                        </button>
                      ))}
                      {draft.photos.length > STRIP_SIZE ? (
                        <span className="self-center text-xs text-navy-700/50">+{draft.photos.length - STRIP_SIZE} more</span>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="ghost" size="sm" disabled={busy || saving} onClick={() => void rewrite(draft)}>
                      {busy ? <Loader2 className="animate-spin" size={13} /> : <Sparkles size={13} />}
                      Rewrite with AI
                    </Button>
                    {draft.photos.length > 1 && draft.photos.length <= MAX_SPLIT ? (
                      <Button type="button" variant="ghost" size="sm" disabled={busy || saving} onClick={() => void split(draft)}>
                        <Scissors size={13} />
                        One milestone per photo
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
        <span className="text-xs text-navy-700/60" aria-live="polite">
          {saving ? `Saving ${phase.done + 1} of ${phase.total}…` : null}
        </span>
        <Button type="button" variant="outline" disabled={saving} onClick={reset}>
          Cancel
        </Button>
        <Button type="button" disabled={saving || chosenCount === 0 || rewritingId !== null} onClick={() => void save()}>
          {saving ? <Loader2 className="animate-spin" size={14} /> : null}
          Add {chosenCount} milestone{chosenCount === 1 ? "" : "s"}
        </Button>
      </div>
    </section>
  );
}

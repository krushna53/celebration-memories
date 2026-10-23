"use client";

import { useEffect, useRef, useState } from "react";
import { FolderArchive, Info, Loader2, Scissors, Sparkles, X } from "lucide-react";

import type { TimelineMilestoneRecord } from "@/types/content";

import { Button } from "@/components/ui/button";
import {
  MAX_GROUPS,
  defaultCover,
  distanceKm,
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
import { staleDeployMessage, type TimelineActions } from "@/features/admin/timeline/timeline-manager";
import type { TimelinePhotoGroupInput } from "@/types/timeline-import";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

const ACCEPT = ".zip,application/zip,application/x-zip-compressed,image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";
/** Splitting a big group into one milestone per photo only makes sense for a handful of photos. */
const MAX_SPLIT = 12;
/** Strip of cover choices shown per draft. */
const STRIP_SIZE = 12;
/** Extra photos uploaded per milestone per import — spread evenly across the group so a 300-photo wedding is still represented. */
const MAX_EXTRAS = 24;
/** A group "belongs" to an existing milestone when its dates are within this many days of the milestone's… */
const MATCH_DAYS = 2;
/** …and (when both know where) it's this close. */
const MATCH_KM = 80;

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
  /** Existing milestone these photos look like they belong to (same dates and area). */
  matchId: string | null;
  /** Where they'll go: an existing milestone's id, or null for a new milestone. */
  targetId: string | null;
  /** New milestones: also save the group's other photos as extra photos. */
  addExtras: boolean;
}

type Phase =
  | { kind: "idle" }
  | { kind: "working"; message: string }
  | { kind: "review" }
  | { kind: "saving"; message: string };

interface PhotoTimelineImportProps {
  eventId: string;
  existingMilestones: TimelineMilestoneRecord[];
  actions: Pick<TimelineActions, "createMilestone" | "describePlace" | "suggestFromPhotos" | "addPhotos" | "getFingerprints">;
  /** TimelineManager's own compress → signed upload, so imported photos are stored exactly like hand-added ones. */
  uploadMedia: (file: File) => Promise<string>;
  uploadToMilestone: (milestoneId: string, file: File, fingerprint?: string | null) => Promise<void>;
}

/** Thrown to stop a whole save/import when the page is out of date — retrying the next item can't help. */
class StaleDeployError extends Error {}

/** Rethrows a stale-deploy failure as StaleDeployError; anything else passes through unchanged. */
function rethrowIfStale(err: unknown): never {
  const stale = staleDeployMessage(err);
  throw stale ? new StaleDeployError(stale) : err;
}

function dayRange(photos: ImportedPhoto[]): { from: string; to: string } | null {
  const days = photos.map((p) => p.takenAt?.slice(0, 10)).filter((d): d is string => Boolean(d)).sort();
  const from = days[0];
  const to = days[days.length - 1];
  return from && to ? { from, to } : null;
}

function shiftDay(day: string, by: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + by);
  return d.toISOString().slice(0, 10);
}

/** The existing milestone whose stored dates (± a couple of days) and place fit this group best, if any. */
function findMatch(photos: ImportedPhoto[], existing: TimelineMilestoneRecord[]): string | null {
  const range = dayRange(photos);
  if (!range) return null;
  const loc = groupLocation({ id: "", photos });
  let best: { id: string; gap: number } | null = null;
  for (const m of existing) {
    if (!m.takenFrom || !m.takenTo) continue;
    const from = shiftDay(m.takenFrom, -MATCH_DAYS);
    const to = shiftDay(m.takenTo, MATCH_DAYS);
    if (range.to < from || range.from > to) continue;
    if (loc && m.lat != null && m.lon != null && distanceKm(loc.lat, loc.lon, m.lat, m.lon) > MATCH_KM) continue;
    const gap = Math.abs(Date.parse(range.from) - Date.parse(m.takenFrom));
    if (!best || gap < best.gap) best = { id: m.id, gap };
  }
  return best?.id ?? null;
}

/** Up to `max` photos spread evenly through the list (oldest to newest). */
function spread<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  return Array.from({ length: max }, (_, i) => items[Math.floor((i * items.length) / max)] as T);
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

export function PhotoTimelineImport({ eventId, existingMilestones, actions, uploadMedia, uploadToMilestone }: PhotoTimelineImportProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [rewritingId, setRewritingId] = useState<string | null>(null);
  // Place names per rounded GPS position, so a re-split never geocodes the same spot twice.
  const placeCache = useRef(new Map<string, string | null>());

  function reset() {
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
          const result = await actions.describePlace(eventId, loc.lat, loc.lon).catch((err: unknown) => rethrowIfStale(err));
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
      return cover ? cover.getFile().then(makeThumbnailDataUrl).catch(() => null) : Promise.resolve(null);
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
      const result = await actions.suggestFromPhotos(eventId, groups).catch((err: unknown) => {
        const stale = staleDeployMessage(err);
        return stale ? { success: false as const, error: stale } : null;
      });
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
        matchId: null,
        targetId: null,
        addExtras: true,
      };
    });
  }

  async function handleFiles(picked: File[]) {
    if (picked.length === 0) return;
    setNotice(null);
    setPhase({ kind: "working", message: "Opening your photos…" });
    try {
      // First server call doubles as the "is this page up to date?" check — before minutes of reading.
      const known = await actions
        .getFingerprints(eventId)
        .then((r) => (r.success ? r.data : {}))
        .catch((err: unknown) => rethrowIfStale(err));

      const read = await readPhotos(picked, (message) => setPhase({ kind: "working", message }));
      const { skipped, videos, duplicates, fromGoogle, fromFileName, overLimit } = read;
      const photos = read.photos.filter((p) => !known[p.fingerprint]);
      const alreadyThere = read.photos.length - photos.length;
      if (photos.length === 0) {
        setNotice(
          alreadyThere
            ? `All ${alreadyThere} photos are already on your timeline.`
            : "We couldn't find any photos in that — use JPEG, PNG, WebP or HEIC files, or a .zip of them.",
        );
        setPhase({ kind: "idle" });
        return;
      }

      const groups = groupPhotos(photos);
      let drafts = await buildDrafts(groups, (done) =>
        setPhase({ kind: "working", message: `Finding where they were taken… ${done} of ${groups.length}` }),
      );
      // Photos from a day/trip that's already a milestone go to it by default — no new milestone, no AI call.
      drafts = drafts.map((d) => {
        const matchId = findMatch(d.photos, existingMilestones);
        return { ...d, matchId, targetId: matchId };
      });
      const toWrite = drafts.filter((d) => !d.targetId);
      setPhase({ kind: "working", message: `Writing ${toWrite.length} milestone${toWrite.length === 1 ? "" : "s"} with AI…` });
      const written = toWrite.length ? await writeWithAi(toWrite) : { drafts: [], aiOk: true };
      const writtenById = new Map(written.drafts.map((d) => [d.id, d]));
      drafts = sortDrafts(drafts.map((d) => writtenById.get(d.id) ?? d));
      const matched = drafts.filter((d) => d.targetId).length;

      const undated = photos.filter((p) => !p.takenAt).length;
      const notes = [
        `${photos.length} photo${photos.length === 1 ? "" : "s"} → ${drafts.length} milestone${drafts.length === 1 ? "" : "s"}.`,
        undated
          ? `${undated} had no date${written.aiOk ? " — the AI guessed their decade from the picture, so check those" : " — add a period for those yourself"}.`
          : null,
        matched ? `${matched} group${matched === 1 ? "" : "s"} match a milestone you already have — they'll be added to it.` : null,
        alreadyThere ? `${alreadyThere} photo${alreadyThere === 1 ? " is" : "s are"} already on your timeline and skipped.` : null,
        fromGoogle ? `${fromGoogle} got their date or place from Google Photos.` : null,
        fromFileName ? `${fromFileName} were dated from their filename only — worth a check.` : null,
        duplicates ? `${duplicates} duplicate${duplicates === 1 ? "" : "s"} skipped (the same photo in several albums or accounts).` : null,
        overLimit ? `${overLimit} more were left out (limit is ${photos.length} per import).` : null,
        videos ? `${videos} video${videos === 1 ? "" : "s"} skipped — add videos to a milestone one at a time below.` : null,
        skipped ? `${skipped} non-photo file${skipped === 1 ? "" : "s"} skipped.` : null,
      ].filter(Boolean);
      setNotice((prev) => (prev ? `${prev} ${notes.join(" ")}` : notes.join(" ")));
      setDrafts(drafts);
      setPhase({ kind: "review" });
    } catch (err) {
      setNotice(staleDeployMessage(err) ?? (err instanceof Error ? err.message : "Couldn't read those photos."));
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

  /** Uploads photos (compressed) and records them as extra photos on a milestone, in batches. Returns how many failed. */
  async function addExtras(milestoneId: string, photos: ImportedPhoto[], meta: Parameters<typeof actions.addPhotos>[2], label: string) {
    let done = 0;
    let failed = 0;
    const uploaded = await mapLimited(photos, 3, async (photo) => {
      try {
        const path = await uploadMedia(await photo.getFile());
        setPhase({ kind: "saving", message: `${label} — photo ${++done} of ${photos.length}…` });
        return { path, originalName: photo.name, takenAt: photo.takenAt, lat: photo.lat, lon: photo.lon, fingerprint: photo.fingerprint };
      } catch (err) {
        if (staleDeployMessage(err)) rethrowIfStale(err);
        failed++;
        return null;
      }
    });
    const ok = uploaded.filter((u): u is NonNullable<typeof u> => u !== null);
    for (let i = 0; i < ok.length; i += 50) {
      const result = await actions.addPhotos(milestoneId, ok.slice(i, i + 50), i === 0 ? meta : undefined).catch(rethrowIfStale);
      if (!result.success) throw new Error(result.error);
    }
    return failed;
  }

  function metaFor(photos: ImportedPhoto[], place: string | null) {
    const range = dayRange(photos);
    const loc = groupLocation({ id: "", photos });
    return { takenFrom: range?.from ?? null, takenTo: range?.to ?? null, lat: loc?.lat ?? null, lon: loc?.lon ?? null, place };
  }

  async function save() {
    const chosen = drafts.filter((d) => d.include);
    const incomplete = chosen.find((d) => !d.targetId && (!d.period.trim() || !d.title.trim() || !d.description.trim()));
    if (incomplete) {
      alert(`Every new milestone needs a period, title and description — “${incomplete.title || incomplete.period || "one of them"}” is missing something.`);
      return;
    }
    const failures: string[] = [];
    let newCount = 0;
    try {
      for (const [i, draft] of chosen.entries()) {
        const label = `Saving ${i + 1} of ${chosen.length}`;
        setPhase({ kind: "saving", message: `${label}…` });
        try {
          if (draft.targetId) {
            const target = existingMilestones.find((m) => m.id === draft.targetId);
            const failed = await addExtras(draft.targetId, spread(draft.photos, MAX_EXTRAS), metaFor(draft.photos, draft.place), label);
            if (failed) failures.push(`${target?.title ?? "Existing milestone"}: ${failed} photo(s) didn't upload`);
            continue;
          }
          const cover = draft.photos.find((p) => p.id === draft.coverId) ?? draft.photos[0];
          const created = await actions
            .createMilestone({
              eventId,
              period: draft.period.trim(),
              title: draft.title.trim(),
              description: draft.description.trim(),
              sortOrder: existingMilestones.length + newCount++,
              meta: { ...metaFor(draft.photos, draft.place), imageFingerprint: cover?.fingerprint ?? null },
            })
            .catch(rethrowIfStale);
          if (!created.success) {
            failures.push(`${draft.title}: ${created.error}`);
            continue;
          }
          if (cover) await uploadToMilestone(created.data.id, await cover.getFile(), cover.fingerprint);
          const others = draft.photos.filter((p) => p.id !== cover?.id);
          if (draft.addExtras && others.length > 0) {
            const failed = await addExtras(created.data.id, spread(others, MAX_EXTRAS), undefined, label);
            if (failed) failures.push(`${draft.title}: ${failed} extra photo(s) didn't upload`);
          }
        } catch (err) {
          if (err instanceof StaleDeployError || staleDeployMessage(err)) throw err;
          failures.push(`${draft.title || "A milestone"}: ${err instanceof Error ? err.message : "failed"}`);
        }
      }
    } catch (err) {
      // Out of date page: stop here (anything already saved stays saved) and say how to continue.
      alert(staleDeployMessage(err) ?? (err instanceof Error ? err.message : "Saving failed."));
      window.location.reload();
      return;
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
        <GoogleTakeoutGuide />
      </div>
    );
  }

  const chosenCount = drafts.filter((d) => d.include).length;
  const saving = phase.kind === "saving";

  return (
    <section aria-label="Review imported milestones" className="mb-6 rounded-xl border border-gold-500/30 bg-white p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg text-navy-950">Review your photos</h3>
          <p className="text-xs text-navy-700/60">
            Untick any you don&rsquo;t want, tap a photo to make it the milestone&rsquo;s main picture, and edit the words freely. New milestones
            are added after your existing ones — reorder afterwards with the arrows. Your existing milestones&rsquo; main photos are never changed.
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
                    <LazyThumb photo={cover} className="h-20 w-20 rounded object-cover sm:h-24 sm:w-24" />
                  ) : null}
                </label>

                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-xs text-navy-700/60">
                    {[draft.dateLabel ?? "No date in the files", draft.place, `${draft.photos.length} photo${draft.photos.length === 1 ? "" : "s"}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {draft.matchId ? (
                    <select
                      className={inputClasses}
                      aria-label="Where these photos go"
                      value={draft.targetId ?? ""}
                      onChange={(e) => update(draft.id, { targetId: e.target.value || null })}
                    >
                      <option value={draft.matchId}>
                        Add to “{existingMilestones.find((m) => m.id === draft.matchId)?.title ?? "existing milestone"}” (same dates
                        {draft.place ? " and place" : ""})
                      </option>
                      <option value="">Create a new milestone instead</option>
                    </select>
                  ) : null}
                  {draft.targetId ? (
                    <p className="text-xs text-navy-700/70">
                      {Math.min(draft.photos.length, MAX_EXTRAS)} photo{Math.min(draft.photos.length, MAX_EXTRAS) === 1 ? "" : "s"} will be added to
                      this milestone&rsquo;s photos{draft.photos.length > MAX_EXTRAS ? ` (spread across all ${draft.photos.length})` : ""}. Its main
                      photo and text stay as they are.
                    </p>
                  ) : (
                  <>
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
                          aria-label={`Use ${photo.name} as the photo`}
                          className={`h-10 w-10 overflow-hidden rounded ${photo.id === cover?.id ? "ring-2 ring-gold-500" : "opacity-70 hover:opacity-100"}`}
                        >
                          <LazyThumb photo={photo} className="h-full w-full object-cover" />
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
                  {draft.photos.length > 1 ? (
                    <label className="flex items-center gap-2 text-xs text-navy-700/70">
                      <input
                        type="checkbox"
                        checked={draft.addExtras}
                        onChange={(e) => update(draft.id, { addExtras: e.target.checked })}
                        className="h-3.5 w-3.5 accent-gold-600"
                      />
                      Also add {Math.min(draft.photos.length - 1, MAX_EXTRAS)} more photo{draft.photos.length - 1 === 1 ? "" : "s"} to this milestone
                      {draft.photos.length - 1 > MAX_EXTRAS ? ` (spread across all ${draft.photos.length - 1})` : ""}
                    </label>
                  ) : null}
                  </>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
        <span className="text-xs text-navy-700/60" aria-live="polite">
          {saving ? phase.message : null}
        </span>
        <Button type="button" variant="outline" disabled={saving} onClick={reset}>
          Cancel
        </Button>
        <Button type="button" disabled={saving || chosenCount === 0 || rewritingId !== null} onClick={() => void save()}>
          {saving ? <Loader2 className="animate-spin" size={14} /> : null}
          Save {chosenCount} item{chosenCount === 1 ? "" : "s"}
        </Button>
      </div>
    </section>
  );
}

/**
 * Shows one imported photo. Its bytes are only read from the zip when the
 * thumbnail is actually rendered — a 5,000-photo export never has 5,000
 * object URLs (or inflated files) alive at once.
 */
function LazyThumb({ photo, className }: { photo: ImportedPhoto; className: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    photo
      .getFile()
      .then((file) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(file);
        setUrl(objectUrl);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photo]);
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt="" className={className} /> : <span className={`block bg-navy-950/5 ${className}`} />;
}

/** How to get photos out of Google Photos WITH their dates and places — the Takeout export keeps both (google-takeout.ts reads them). */
function GoogleTakeoutGuide() {
  return (
    <details className="mt-3 rounded-lg border border-navy-950/10 px-3 py-2 text-xs text-navy-700/70">
      <summary className="flex cursor-pointer items-center gap-1.5 font-medium text-navy-950">
        <Info size={13} className="text-gold-600" /> Photos in Google Photos? Export them with their dates and places
      </summary>
      <ol className="mt-2 list-decimal space-y-1 pl-5">
        <li>
          On a computer, open{" "}
          <a href="https://takeout.google.com" target="_blank" rel="noopener noreferrer" className="text-gold-700 underline">
            takeout.google.com
          </a>{" "}
          and sign in to the Google account that has the photos.
        </li>
        <li>
          Click <strong>Deselect all</strong>, then tick only <strong>Google Photos</strong>. Use{" "}
          <strong>All photo albums included</strong> to pick just the albums or years you want — smaller is faster.
        </li>
        <li>
          <strong>Next step</strong> → choose <strong>Send download link via email</strong>, <strong>Export once</strong>,
          file type <strong>.zip</strong> and size <strong>2 GB</strong>. Then <strong>Create export</strong>.
        </li>
        <li>
          Google emails you when it&rsquo;s ready (minutes to a few hours). Download <strong>every part</strong> — the
          dates and places for a photo can be in a different part from the photo itself.
        </li>
        <li>
          Click <strong>Build from a zip of photos</strong> and select <strong>all the parts at once</strong>. Don&rsquo;t
          unzip them. Photos from several Google accounts can go in together — the same photo in two accounts or albums
          is only used once.
        </li>
      </ol>
      <p className="mt-2">
        Why Takeout: it includes when and where each photo was taken, even for photos that lost that information (like
        WhatsApp saves). Downloading from photos.google.com or the Google Photos button keeps the date but not the place.
        Your zips are read on your own device — they&rsquo;re never uploaded; only the photo you pick for each milestone is.
        Videos are skipped here; add them to a milestone one at a time.
      </p>
    </details>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, CheckCircle2, GripVertical, Loader2, Pencil, RotateCcw, Sparkles, Trash2, Upload, X } from "lucide-react";

import { CURATED_MEDIA_ACCEPT, isVideoMedia } from "@/lib/curated-media";
import { cn } from "@/lib/utils";
import { supabaseBrowser } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image-compression";
import { readPhotoMetadata } from "@/lib/photo-metadata";
import { GALLERY_CATEGORIES, type GalleryCategory } from "@/features/gallery/gallery-data";
import type { GalleryPairRecord, GalleryPhotoRecord } from "@/types/content";
import {
  confirmGalleryUploadAction,
  deleteGalleryPhotoAction,
  reorderGalleryPhotosAction,
  requestGalleryUploadUrlAction,
  updateGalleryPhotoAction,
} from "@/features/admin/gallery/actions";
import { GalleryAiTagger } from "@/features/admin/gallery/ai-tagger";
import { ThenNowPanel } from "@/features/admin/gallery/then-now-panel";
import { CleanupPanel } from "@/features/admin/gallery/cleanup-panel";
import { GooglePhotosButton } from "@/features/uploads/components/google-photos-button";
import { GoogleDriveButton } from "@/features/uploads/components/google-drive-button";
import { PhotoMetadataTip } from "@/features/uploads/components/photo-metadata-tip";

/** Files uploaded at the same time — quicker than one by one, still gentle on a phone's connection. */
const UPLOAD_CONCURRENCY = 3;

type JobStatus = "waiting" | "preparing" | "uploading" | "sorting" | "done" | "failed";

/** One file in the current upload batch, shown in the progress panel. */
interface UploadJob {
  key: string;
  file: File;
  name: string;
  isVideo: boolean;
  /** Local preview (object URL) — photos only. */
  preview: string | null;
  status: JobStatus;
  error?: string;
}

const STATUS_LABEL: Record<JobStatus, string> = {
  waiting: "Waiting",
  preparing: "Preparing",
  uploading: "Uploading",
  sorting: "AI sorting",
  done: "Done",
  failed: "Failed",
};

/**
 * Live progress for a gallery upload batch: how many are done, a
 * "keep this page open" reminder while it runs, and each file's own step,
 * so a slow batch (big videos, AI sorting) never looks stuck.
 */
function UploadProgressPanel({
  jobs,
  running,
  onRetry,
  onDismiss,
}: {
  jobs: UploadJob[];
  running: boolean;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  const done = jobs.filter((j) => j.status === "done").length;
  const failed = jobs.filter((j) => j.status === "failed").length;
  const finished = done + failed;
  const pct = jobs.length ? Math.round((finished / jobs.length) * 100) : 0;

  return (
    <div
      className={cn(
        "mt-4 rounded-xl border p-4",
        running ? "border-gold-500/40 bg-white" : failed ? "border-red-200 bg-red-50/60" : "border-emerald-200 bg-emerald-50/60",
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          {running ? (
            <Loader2 size={20} className="mt-0.5 shrink-0 animate-spin text-gold-600" />
          ) : failed ? (
            <AlertCircle size={20} className="mt-0.5 shrink-0 text-red-600" />
          ) : (
            <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-600" />
          )}
          <div>
            <p className="font-medium text-navy-950">
              {running
                ? `Uploading ${Math.min(finished + 1, jobs.length)} of ${jobs.length}…`
                : failed
                  ? `${done} of ${jobs.length} uploaded — ${failed} didn’t make it`
                  : `All ${jobs.length} uploaded`}
            </p>
            <p className="mt-0.5 text-xs text-navy-700/70">
              {running
                ? "Please keep this page open until it finishes — closing it or going back will stop the upload."
                : failed
                  ? "You can retry the failed ones, or close this and upload them again later."
                  : "They’re in the gallery below. You can close this."}
            </p>
          </div>
        </div>
        {!running ? (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close upload summary"
            className="tap-target flex shrink-0 items-center justify-center text-navy-700/50 hover:text-navy-950"
          >
            <X size={16} />
          </button>
        ) : null}
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-navy-950/10" aria-hidden>
        <div
          className={cn("h-full rounded-full transition-all duration-500", failed && !running ? "bg-red-500" : "bg-gold-500")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-right text-[11px] text-navy-700/60">{pct}%</p>

      <ul className="mt-2 grid max-h-72 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
        {jobs.map((job) => (
          <li key={job.key} className="flex items-center gap-2.5 rounded-lg border border-navy-950/10 bg-white p-2">
            {job.preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={job.preview} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
            ) : (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-navy-950/5 text-[10px] text-navy-700/60">
                {job.isVideo ? "Video" : "Photo"}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-navy-950">{job.name}</p>
              <p
                className={cn(
                  "flex items-center gap-1 text-[11px]",
                  job.status === "done" ? "text-emerald-700" : job.status === "failed" ? "text-red-600" : "text-navy-700/60",
                )}
              >
                {job.status === "done" ? (
                  <Check size={11} />
                ) : job.status === "failed" ? (
                  <AlertCircle size={11} />
                ) : job.status !== "waiting" ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : null}
                <span className="truncate">{job.status === "failed" && job.error ? job.error : STATUS_LABEL[job.status]}</span>
              </p>
            </div>
          </li>
        ))}
      </ul>

      {!running && failed > 0 ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-navy-950 px-4 py-2 text-sm font-medium text-ivory-50 hover:bg-navy-900"
        >
          <RotateCcw size={14} /> Retry {failed} failed
        </button>
      ) : null}
    </div>
  );
}

/** See AiImageActions's doc comment — same override pattern for the self-serve wizard. */
export interface GalleryActions {
  requestUploadUrl: typeof requestGalleryUploadUrlAction;
  confirmUpload: typeof confirmGalleryUploadAction;
  deletePhoto: typeof deleteGalleryPhotoAction;
  updatePhoto: typeof updateGalleryPhotoAction;
}

const DEFAULT_ACTIONS: GalleryActions = {
  requestUploadUrl: requestGalleryUploadUrlAction,
  confirmUpload: confirmGalleryUploadAction,
  deletePhoto: deleteGalleryPhotoAction,
  updatePhoto: updateGalleryPhotoAction,
};

interface GalleryManagerProps {
  eventId: string;
  initialPhotos: GalleryPhotoRecord[];
  actions?: GalleryActions;
  /** Admin only — "Then & Now" pairs for this event. */
  initialPairs?: GalleryPairRecord[];
  /** Whether AI auto-sorting is available (OPENAI_API_KEY set) — shows the "Auto-sort & caption" toggle. */
  aiAutoTagAvailable?: boolean;
}

const CATEGORY_OPTIONS = GALLERY_CATEGORIES.filter(
  (c): c is { value: GalleryCategory; label: string } => c.value !== "all",
);

const inputCls =
  "w-full rounded border border-navy-950/15 bg-white px-2 py-1 text-xs text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500/30";

/** Inline caption + category editor shown below a photo card when the pencil is clicked. */
function CaptionEditor({
  photoId,
  initial,
  initialCategory,
  updatePhoto,
  onSaved,
  onCancel,
}: {
  photoId: string;
  initial: string;
  initialCategory: GalleryCategory;
  updatePhoto: GalleryActions["updatePhoto"];
  onSaved: (caption: string, category: GalleryCategory) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [category, setCategory] = useState(initialCategory);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await updatePhoto(photoId, { caption: value.trim() || null, category });
    setSaving(false);
    if (result.success) onSaved(value.trim(), category);
    else setError(result.error);
  }

  return (
    <div className="flex flex-col gap-1.5 border-t border-navy-950/10 bg-ivory-50 p-2">
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value as GalleryCategory)}
        aria-label="Category"
        className={inputCls}
      >
        {CATEGORY_OPTIONS.map((c) => (
          <option key={c.value} value={c.value}>{c.label}</option>
        ))}
      </select>
      <input
        className={inputCls}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add a caption…"
        maxLength={200}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") onCancel();
        }}
      />
      <div className="flex gap-1">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1 rounded bg-gold-500 px-2 py-0.5 text-[11px] font-medium text-navy-950 hover:bg-gold-400 disabled:opacity-60"
        >
          {saving ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
          Save
        </button>
        <button onClick={onCancel} className="rounded px-2 py-0.5 text-[11px] text-navy-700/60 hover:text-navy-950">
          Cancel
        </button>
      </div>
      {error ? <p className="text-[11px] text-red-600">{error}</p> : null}
    </div>
  );
}

/**
 * Draggable photo grid for one category.
 * Uses native HTML5 drag-and-drop — no extra library.
 * Drag the grip handle (⠿) to reorder. Order is saved to the DB on drop
 * and is the same order used by the Big Screen display.
 */
function CategoryGrid({
  label,
  initialPhotos,
  busyId,
  onDelete,
  updatePhoto,
  onUpdated,
  autoTaggedIds,
}: {
  label: string;
  initialPhotos: GalleryPhotoRecord[];
  busyId: string | null;
  onDelete: (id: string) => void;
  updatePhoto: GalleryActions["updatePhoto"];
  /** Lifts an edit to the parent — a category change moves the photo to another grid. */
  onUpdated: (id: string, patch: { caption: string; category: GalleryCategory }) => void;
  /** Photos the AI sorted/captioned in this session — get an "Auto" badge until the page reloads. */
  autoTaggedIds: ReadonlySet<string>;
}) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // DnD state
  const dragIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  function handleDragStart(e: React.DragEvent, idx: number) {
    dragIdx.current = idx;
    e.dataTransfer.effectAllowed = "move";
    // Transparent drag image so the card doesn't ghost weirdly
    const el = e.currentTarget as HTMLElement;
    e.dataTransfer.setDragImage(el, el.offsetWidth / 2, el.offsetHeight / 2);
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIdx(idx);
  }

  function handleDragLeave() {
    setDragOverIdx(null);
  }

  async function handleDrop(e: React.DragEvent, dropIdx: number) {
    e.preventDefault();
    setDragOverIdx(null);
    const from = dragIdx.current;
    dragIdx.current = null;
    if (from === null || from === dropIdx) return;

    // Optimistic reorder
    const next = [...photos];
    const [moved] = next.splice(from, 1);
    next.splice(dropIdx, 0, moved!);
    setPhotos(next);

    // Persist
    setSaving(true);
    setSaveError(null);
    const result = await reorderGalleryPhotosAction(next.map((p) => p.id));
    setSaving(false);
    if (!result.success) {
      setSaveError("Order not saved — please try again.");
      setPhotos(photos); // revert
    }
  }

  function handleDragEnd() {
    dragIdx.current = null;
    setDragOverIdx(null);
  }

  if (photos.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="flex items-center gap-3">
        <h2 className="font-display text-lg text-navy-950">{label}</h2>
        {saving && (
          <span className="flex items-center gap-1 text-xs text-navy-700/50">
            <Loader2 size={11} className="animate-spin" /> Saving order…
          </span>
        )}
        {saveError && <span className="text-xs text-red-600">{saveError}</span>}
        {!saving && !saveError && photos.length > 1 && (
          <span className="text-[10px] text-navy-700/30">Drag ⠿ to reorder</span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((photo, idx) => (
          <div
            key={photo.id}
            draggable
            onDragStart={(e) => handleDragStart(e, idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, idx)}
            onDragEnd={handleDragEnd}
            className={cn(
              "group relative overflow-hidden rounded-lg border bg-white transition-all duration-150",
              busyId === photo.id && "opacity-50",
              dragOverIdx === idx
                ? "border-gold-500 ring-2 ring-gold-400/40 scale-[1.02]"
                : "border-navy-950/10",
              dragIdx.current === idx && "opacity-40",
            )}
          >
            <div className="relative">
              {isVideoMedia(photo.url) ? (
                <video src={photo.url} controls playsInline preload="metadata" aria-label={photo.caption || "Gallery video"} className="aspect-square w-full bg-black object-contain" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo.url} alt={photo.caption ?? ""} className="aspect-square w-full object-cover" />
              )}

              {/* Drag handle — always visible on touch/mobile, hover on desktop */}
              <div
                className="absolute left-1 top-1 cursor-grab touch-none rounded bg-navy-950/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
                title="Drag to reorder"
                aria-label="Drag to reorder"
              >
                <GripVertical size={14} />
              </div>

              {/* Edit / Delete buttons */}
              <div className="flex items-center justify-end gap-2 border-t border-navy-950/10 bg-white p-2">
                <button
                  type="button"
                  onClick={() => setEditingId(editingId === photo.id ? null : photo.id)}
                  title="Edit caption & category"
                  aria-label="Edit caption and category"
                  className="tap-target flex items-center justify-center rounded-full bg-navy-950/70 text-white"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(photo.id)}
                  disabled={busyId !== null}
                  title="Delete"
                  aria-label={`Delete ${isVideoMedia(photo.url) ? "video" : "photo"}${photo.caption ? `: ${photo.caption}` : ""}`}
                  className="tap-target flex items-center justify-center rounded-full bg-navy-950/70 text-white"
                >
                  {busyId === photo.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  <span className="px-2 text-xs">Delete</span>
                </button>
              </div>

              {autoTaggedIds.has(photo.id) ? (
                <span
                  className="absolute right-1 top-1 inline-flex items-center gap-1 rounded-full bg-gold-500 px-2 py-0.5 text-[10px] font-medium text-navy-950 shadow"
                  title="Category and caption suggested by AI — tap the pencil to change them"
                >
                  <Sparkles size={10} /> Auto
                </span>
              ) : null}

              {/* Caption badge */}
              {photo.caption && editingId !== photo.id ? (
                <div className="bg-navy-950/60 px-2 py-1">
                  <p className="truncate text-[11px] text-ivory-100">{photo.caption}</p>
                </div>
              ) : null}
            </div>

            {/* Inline caption editor */}
            {editingId === photo.id ? (
              <CaptionEditor
                photoId={photo.id}
                initial={photo.caption ?? ""}
                initialCategory={photo.category}
                updatePhoto={updatePhoto}
                onSaved={(caption, category) => {
                  setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, caption } : p)));
                  setEditingId(null);
                  onUpdated(photo.id, { caption, category });
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function GalleryManager({
  eventId,
  initialPhotos,
  actions = DEFAULT_ACTIONS,
  initialPairs = [],
  aiAutoTagAvailable = false,
}: GalleryManagerProps) {
  const router = useRouter();
  const [photos, setPhotos] = useState(initialPhotos);
  const [previousPhotos, setPreviousPhotos] = useState(initialPhotos);
  if (previousPhotos !== initialPhotos) {
    setPreviousPhotos(initialPhotos);
    setPhotos(initialPhotos);
  }
  const [category, setCategory] = useState<GalleryCategory>("family");
  const [uploadCaption, setUploadCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [jobs, setJobs] = useState<UploadJob[] | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  // Leaving mid-upload stops it — make the browser ask first.
  useEffect(() => {
    if (!uploading) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [uploading]);

  // Local thumbnail URLs for the current batch — freed when it's closed/replaced or the page unmounts.
  const previewUrls = useRef<string[]>([]);
  function releasePreviews() {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrls.current = [];
  }
  useEffect(() => releasePreviews, []);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [autoTag, setAutoTag] = useState(aiAutoTagAvailable);
  const [autoTaggedIds, setAutoTaggedIds] = useState<ReadonlySet<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);

  function updateJob(key: string, patch: Partial<UploadJob>) {
    setJobs((prev) => prev?.map((j) => (j.key === key ? { ...j, ...patch } : j)) ?? prev);
  }

  /** Prepares, uploads and records one file, reporting each step to the progress panel. */
  async function uploadOne(job: UploadJob): Promise<{ taggedId: string | null; hadMetadata: boolean } | null> {
    try {
      updateJob(job.key, { status: "preparing", error: undefined });
      // EXIF must be read from the original — compression strips it.
      const meta = job.isVideo ? null : await readPhotoMetadata(job.file);
      const file = job.isVideo ? job.file : await compressImage(job.file);
      const signed = await actions.requestUploadUrl(eventId, file.name, file.type, file.size);
      if (!signed.success) throw new Error(signed.error);

      updateJob(job.key, { status: "uploading" });
      const { bucket, path, token } = signed.data;
      const { error: uploadError } = await supabaseBrowser()
        .storage.from(bucket)
        .uploadToSignedUrl(path, token, file, { contentType: signed.data.contentType });
      if (uploadError) throw new Error(uploadError.message);

      const sorting = autoTag && !job.isVideo;
      if (sorting) updateJob(job.key, { status: "sorting" });
      const confirmed = await actions.confirmUpload(eventId, category, path, uploadCaption.trim(), {
        autoTag: sorting,
        takenAt: meta?.takenAt ?? null,
        lat: meta?.lat ?? null,
        lon: meta?.lon ?? null,
      });
      if (!confirmed.success) throw new Error(confirmed.error);

      updateJob(job.key, { status: "done" });
      return {
        taggedId: confirmed.data.autoTagged ? confirmed.data.id : null,
        hadMetadata: Boolean(meta && (meta.takenAt || meta.lat !== null)),
      };
    } catch (err) {
      updateJob(job.key, { status: "failed", error: err instanceof Error ? err.message : "Upload failed." });
      return null;
    }
  }

  async function runJobs(batch: UploadJob[]) {
    setUploading(true);
    setError(null);
    setNotice(null);
    requestAnimationFrame(() => progressRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));

    const tagged: string[] = [];
    let withMetadata = 0;
    let next = 0;
    async function worker() {
      while (next < batch.length) {
        const job = batch[next++]!;
        const result = await uploadOne(job);
        if (result?.taggedId) tagged.push(result.taggedId);
        if (result?.hadMetadata) withMetadata++;
      }
    }
    await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, batch.length) }, worker));

    setUploading(false);
    if (tagged.length > 0) {
      setAutoTaggedIds((prev) => new Set([...prev, ...tagged]));
      setNotice(
        `AI sorted ${tagged.length} photo${tagged.length === 1 ? "" : "s"} into categories and wrote captions${
          withMetadata > 0 ? " using when and where they were taken" : ""
        } — look for the “Auto” badge, and tap the pencil on any photo to change it.`,
      );
    }
    setUploadCaption("");
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  function handleFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0 || uploading) return;
    const stamp = Date.now();
    const batch: UploadJob[] = list.map((file, i) => {
      const isVideo = file.type.startsWith("video/") || isVideoMedia(file.name);
      return {
        key: `${stamp}-${i}`,
        file,
        name: file.name,
        isVideo,
        preview: !isVideo && file.type.startsWith("image/") && !/hei[cf]/i.test(file.type) ? URL.createObjectURL(file) : null,
        status: "waiting",
      };
    });
    releasePreviews();
    previewUrls.current = batch.flatMap((j) => (j.preview ? [j.preview] : []));
    setJobs(batch);
    void runJobs(batch);
  }

  function retryFailed() {
    const failed = (jobs ?? []).filter((j) => j.status === "failed");
    if (failed.length === 0) return;
    const keys = new Set(failed.map((j) => j.key));
    setJobs((prev) => prev?.map((j) => (keys.has(j.key) ? { ...j, status: "waiting", error: undefined } : j)) ?? prev);
    void runJobs(failed.map((j) => ({ ...j, status: "waiting" as const, error: undefined })));
  }

  function handlePhotoUpdated(id: string, patch: { caption: string; category: GalleryCategory }) {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  async function handleDelete(id: string) {
    if (!confirm(actions === DEFAULT_ACTIONS ? "Move this item to the Recycle Bin? You can restore it for 30 days." : "Delete this item?")) return;
    setError(null);
    setBusyId(id);
    try {
      const result = await actions.deletePhoto(id);
      if (!result.success) throw new Error(result.error);
      setPhotos((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this item. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      {/* Upload bar */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gold-500/20 bg-gold-500/5 p-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-medium uppercase tracking-widest text-navy-700/50">
            {autoTag ? "Category for videos / if unsure" : "Category"}
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as GalleryCategory)}
            className="rounded-lg border border-navy-950/15 bg-white px-3 py-2 text-sm"
          >
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <label className="text-[10px] font-medium uppercase tracking-widest text-navy-700/50">
            Caption <span className="normal-case font-normal">(optional — shown on big screen)</span>
          </label>
          <input
            className="rounded-lg border border-navy-950/15 bg-white px-3 py-2 text-sm placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
            placeholder="e.g. Family reunion, 1998"
            value={uploadCaption}
            onChange={(e) => setUploadCaption(e.target.value)}
            maxLength={200}
          />
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={CURATED_MEDIA_ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 rounded-lg bg-gold-500 px-4 py-2 text-sm font-medium text-navy-950 disabled:opacity-60"
        >
          {uploading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
          {uploading && jobs
            ? `Uploading ${Math.min(jobs.filter((j) => j.status === "done" || j.status === "failed").length + 1, jobs.length)} of ${jobs.length}…`
            : autoTag
              ? "Upload photos or videos"
              : `Upload photos or videos to ${CATEGORY_OPTIONS.find((c) => c.value === category)?.label}`}
        </button>
        {/* Imports straight into the selected category — renders nothing without a Google Photos client id. */}
        {!uploading ? <GooglePhotosButton onFiles={handleFiles} label="From Google Photos" className="w-full sm:w-56" /> : null}
        {!uploading ? <GoogleDriveButton onFiles={handleFiles} includeVideos label="From Google Drive" className="w-full sm:w-56" /> : null}
        {aiAutoTagAvailable ? (
          <label className="flex w-full items-start gap-2 text-sm text-navy-950">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-gold-500"
              checked={autoTag}
              onChange={(e) => setAutoTag(e.target.checked)}
            />
            <span>
              <Sparkles size={13} className="mr-1 inline text-gold-600" />
              Auto-sort &amp; caption photos with AI
              <span className="block text-xs text-navy-700/60">
                Picks the category and writes a short caption for each photo — using when and where it was taken, if
                the photo knows. Anything you type in Caption above is kept instead. You can edit both afterwards.
              </span>
            </span>
          </label>
        ) : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {notice ? (
          <p className="w-full text-sm text-navy-950" role="status">
            {notice}
          </p>
        ) : null}
      </div>
      <div ref={progressRef}>
        {jobs ? (
          <UploadProgressPanel jobs={jobs} running={uploading} onRetry={retryFailed} onDismiss={() => {
              releasePreviews();
              setJobs(null);
            }} />
        ) : null}
      </div>
      <PhotoMetadataTip pickHint="tap Upload, then choose Browse / Files / Drive instead of the gallery" />

      {/* Admin only — the /start wizard passes its own token-based actions and has no admin session for the AI actions. */}
      {actions === DEFAULT_ACTIONS && photos.length > 0 ? (
        <>
          <GalleryAiTagger eventId={eventId} photos={photos.filter((photo) => !isVideoMedia(photo.url))} />
          <ThenNowPanel eventId={eventId} photos={photos.filter((photo) => !isVideoMedia(photo.url))} initialPairs={initialPairs} />
          <CleanupPanel photos={photos.filter((photo) => !isVideoMedia(photo.url))} />
        </>
      ) : null}

      <p className="mt-3 text-xs text-navy-700/40">
        Photos up to 50MB; MP4 videos up to 300MB.
        {actions === DEFAULT_ACTIONS ? " Deleted items can be restored from the Recycle Bin for 30 days." : ""}
        Drag the <GripVertical size={11} className="inline" /> handle on any photo to reorder within its category.
        The same order appears on the Big Screen display.
      </p>

      {/* Per-category draggable grids */}
      {CATEGORY_OPTIONS.map((cat) => (
        <CategoryGrid
          key={`${cat.value}:${photos.filter((p) => p.category === cat.value).map((p) => p.id).join(",")}`}
          label={cat.label}
          initialPhotos={photos.filter((p) => p.category === cat.value)}
          busyId={busyId}
          onDelete={handleDelete}
          updatePhoto={actions.updatePhoto}
          onUpdated={handlePhotoUpdated}
          autoTaggedIds={autoTaggedIds}
        />
      ))}

      {photos.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-navy-950/15 py-16 text-center text-sm text-navy-700/50">
          No gallery photos or videos yet — upload some above.
        </p>
      ) : null}
    </div>
  );
}

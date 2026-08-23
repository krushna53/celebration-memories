"use client";

import { useRef, useState } from "react";
import { Check, GripVertical, Loader2, Pencil, Trash2, Upload, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { supabaseBrowser } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image-compression";
import { GALLERY_CATEGORIES, type GalleryCategory } from "@/features/gallery/gallery-data";
import type { GalleryPhotoRecord } from "@/types/content";
import {
  confirmGalleryUploadAction,
  deleteGalleryPhotoAction,
  reorderGalleryPhotosAction,
  requestGalleryUploadUrlAction,
  updateGalleryPhotoAction,
} from "@/features/admin/gallery/actions";

/** See AiImageActions's doc comment — same override pattern for the self-serve wizard. */
export interface GalleryActions {
  requestUploadUrl: typeof requestGalleryUploadUrlAction;
  confirmUpload: typeof confirmGalleryUploadAction;
  deletePhoto: typeof deleteGalleryPhotoAction;
}

const DEFAULT_ACTIONS: GalleryActions = {
  requestUploadUrl: requestGalleryUploadUrlAction,
  confirmUpload: confirmGalleryUploadAction,
  deletePhoto: deleteGalleryPhotoAction,
};

interface GalleryManagerProps {
  eventId: string;
  initialPhotos: GalleryPhotoRecord[];
  actions?: GalleryActions;
}

const CATEGORY_OPTIONS = GALLERY_CATEGORIES.filter(
  (c): c is { value: GalleryCategory; label: string } => c.value !== "all",
);

const inputCls =
  "w-full rounded border border-navy-950/15 bg-white px-2 py-1 text-xs text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500/30";

/** Inline caption editor shown below a photo card when the pencil is clicked. */
function CaptionEditor({
  photoId,
  initial,
  onSaved,
  onCancel,
}: {
  photoId: string;
  initial: string;
  onSaved: (caption: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const result = await updateGalleryPhotoAction(photoId, { caption: value.trim() || null });
    setSaving(false);
    if (result.success) onSaved(value.trim());
  }

  return (
    <div className="flex flex-col gap-1.5 border-t border-navy-950/10 bg-ivory-50 p-2">
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
  category,
  label,
  initialPhotos,
  busyId,
  onDelete,
}: {
  category: GalleryCategory;
  label: string;
  initialPhotos: GalleryPhotoRecord[];
  busyId: string | null;
  onDelete: (id: string) => void;
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt={photo.caption ?? ""} className="aspect-square w-full object-cover" />

              {/* Drag handle — always visible on touch/mobile, hover on desktop */}
              <div
                className="absolute left-1 top-1 cursor-grab touch-none rounded bg-navy-950/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
                title="Drag to reorder"
                aria-label="Drag to reorder"
              >
                <GripVertical size={14} />
              </div>

              {/* Edit / Delete buttons */}
              <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => setEditingId(editingId === photo.id ? null : photo.id)}
                  title="Edit caption"
                  className="tap-target flex items-center justify-center rounded-full bg-navy-950/70 text-white"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(photo.id)}
                  disabled={busyId === photo.id}
                  title="Delete"
                  className="tap-target flex items-center justify-center rounded-full bg-navy-950/70 text-white"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Caption badge */}
              {photo.caption && editingId !== photo.id ? (
                <div className="absolute bottom-0 left-0 right-0 bg-navy-950/60 px-2 py-1">
                  <p className="truncate text-[11px] text-ivory-100">{photo.caption}</p>
                </div>
              ) : null}
            </div>

            {/* Inline caption editor */}
            {editingId === photo.id ? (
              <CaptionEditor
                photoId={photo.id}
                initial={photo.caption ?? ""}
                onSaved={(caption) => {
                  setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, caption } : p)));
                  setEditingId(null);
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

export function GalleryManager({ eventId, initialPhotos, actions = DEFAULT_ACTIONS }: GalleryManagerProps) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [category, setCategory] = useState<GalleryCategory>("family");
  const [uploadCaption, setUploadCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList) {
    setUploading(true);
    setError(null);

    for (const rawFile of Array.from(files)) {
      try {
        const file = await compressImage(rawFile);
        const signed = await actions.requestUploadUrl(eventId, file.name, file.type, file.size);
        if (!signed.success) throw new Error(signed.error);

        const { bucket, path, token } = signed.data;
        const { error: uploadError } = await supabaseBrowser()
          .storage.from(bucket)
          .uploadToSignedUrl(path, token, file);
        if (uploadError) throw new Error(uploadError.message);

        const confirmed = await actions.confirmUpload(eventId, category, path, uploadCaption.trim());
        if (!confirmed.success) throw new Error(confirmed.error);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed.");
      }
    }

    setUploading(false);
    setUploadCaption("");
    window.location.reload();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this photo?")) return;
    setBusyId(id);
    const result = await actions.deletePhoto(id);
    setBusyId(null);
    if (result.success) {
      setPhotos((prev) => prev.filter((p) => p.id !== id));
    } else {
      alert(result.error);
    }
  }

  return (
    <div>
      {/* Upload bar */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gold-500/20 bg-gold-500/5 p-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-medium uppercase tracking-widest text-navy-700/50">Category</label>
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
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
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
          Upload to {CATEGORY_OPTIONS.find((c) => c.value === category)?.label}
        </button>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>

      <p className="mt-3 text-xs text-navy-700/40">
        Drag the <GripVertical size={11} className="inline" /> handle on any photo to reorder within its category.
        The same order appears on the Big Screen display.
      </p>

      {/* Per-category draggable grids */}
      {CATEGORY_OPTIONS.map((cat) => (
        <CategoryGrid
          key={cat.value}
          category={cat.value}
          label={cat.label}
          initialPhotos={photos.filter((p) => p.category === cat.value)}
          busyId={busyId}
          onDelete={handleDelete}
        />
      ))}

      {photos.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-navy-950/15 py-16 text-center text-sm text-navy-700/50">
          No gallery photos yet — upload some above.
        </p>
      ) : null}
    </div>
  );
}

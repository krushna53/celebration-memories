"use client";

import { useRef, useState } from "react";
import { Check, Loader2, Pencil, Trash2, Upload, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { supabaseBrowser } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image-compression";
import { GALLERY_CATEGORIES, type GalleryCategory } from "@/features/gallery/gallery-data";
import type { GalleryPhotoRecord } from "@/types/content";
import {
  confirmGalleryUploadAction,
  deleteGalleryPhotoAction,
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
    if (result.success) {
      onSaved(value.trim());
    }
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
        <button
          onClick={onCancel}
          className="rounded px-2 py-0.5 text-[11px] text-navy-700/60 hover:text-navy-950"
        >
          Cancel
        </button>
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
  const [editingId, setEditingId] = useState<string | null>(null);
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

      {/* Photo grid by category */}
      {CATEGORY_OPTIONS.map((cat) => {
        const items = photos.filter((p) => p.category === cat.value);
        if (items.length === 0) return null;

        return (
          <div key={cat.value} className="mt-8">
            <h2 className="font-display text-lg text-navy-950">{cat.label}</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((photo) => (
                <div
                  key={photo.id}
                  className={cn(
                    "group overflow-hidden rounded-lg border border-navy-950/10 bg-white",
                    busyId === photo.id && "opacity-50",
                  )}
                >
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.url} alt={photo.caption ?? ""} className="aspect-square w-full object-cover" />

                    {/* Hover actions */}
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
                        onClick={() => handleDelete(photo.id)}
                        disabled={busyId === photo.id}
                        title="Delete"
                        className="tap-target flex items-center justify-center rounded-full bg-navy-950/70 text-white"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Caption badge on image if set */}
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
                        setPhotos((prev) =>
                          prev.map((p) => (p.id === photo.id ? { ...p, caption } : p)),
                        );
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
      })}

      {photos.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-navy-950/15 py-16 text-center text-sm text-navy-700/50">
          No gallery photos yet — upload some above.
        </p>
      ) : null}
    </div>
  );
}

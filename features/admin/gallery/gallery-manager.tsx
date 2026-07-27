"use client";

import { useRef, useState } from "react";
import { Loader2, Trash2, Upload } from "lucide-react";

import { cn } from "@/lib/utils";
import { supabaseBrowser } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image-compression";
import { GALLERY_CATEGORIES, type GalleryCategory } from "@/features/gallery/gallery-data";
import type { GalleryPhotoRecord } from "@/types/content";
import {
  confirmGalleryUploadAction,
  deleteGalleryPhotoAction,
  requestGalleryUploadUrlAction,
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

export function GalleryManager({ eventId, initialPhotos, actions = DEFAULT_ACTIONS }: GalleryManagerProps) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [category, setCategory] = useState<GalleryCategory>("family");
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

        const confirmed = await actions.confirmUpload(eventId, category, path, "");
        if (!confirmed.success) throw new Error(confirmed.error);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed.");
      }
    }

    setUploading(false);
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
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gold-500/20 bg-gold-500/5 p-4">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as GalleryCategory)}
          className="rounded-lg border border-navy-950/15 bg-white px-3 py-2 text-sm"
        >
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>

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
          className="flex items-center gap-2 rounded-lg bg-gold-500 px-4 py-2 text-sm font-medium text-navy-950"
        >
          {uploading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
          Upload to {CATEGORY_OPTIONS.find((c) => c.value === category)?.label}
        </button>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>

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
                    "group relative overflow-hidden rounded-lg border border-navy-950/10",
                    busyId === photo.id && "opacity-50",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt={photo.caption ?? ""} className="aspect-square w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleDelete(photo.id)}
                    disabled={busyId === photo.id}
                    className="tap-target absolute right-1 top-1 flex items-center justify-center rounded-full bg-navy-950/70 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Trash2 size={16} />
                  </button>
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

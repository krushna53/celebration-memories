"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Star, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { compressImage } from "@/lib/image-compression";
import { supabaseBrowser } from "@/lib/supabase/client";
import { LIFE_STORY_MAX_PHOTOS, LIFE_STORY_PHOTO_MAX_EDGE } from "@/lib/life-story";
import type { LifeStoryPhoto } from "@/types/life-story";
import {
  confirmPhotoUploadAction,
  deletePhotoAction,
  reorderPhotosAction,
  requestPhotoUploadAction,
  setCoverPhotoAction,
  updatePhotoAction,
} from "@/features/admin/life-story/actions";
import { card, errorText, hint, input } from "@/features/admin/life-story/styles";

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";

async function dimensions(file: File): Promise<{ width: number | null; height: number | null }> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return { width: null, height: null };
  }
}

/**
 * Step 2 — photos. Each one is converted to JPEG and resized in the browser
 * (HEIC included), then PUT straight to Storage via a signed upload URL —
 * never through a Server Action body. Order here is the order the AI sees
 * them in; after the AI pass it follows the chapters.
 */
export function PhotosPanel({
  eventId,
  photos: initial,
  coverPhotoId: initialCover,
  onDone,
}: {
  eventId: string;
  photos: LifeStoryPhoto[];
  coverPhotoId: string | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState(initial);
  const [coverId, setCoverId] = useState(initialCover);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  async function upload(files: File[]) {
    const room = LIFE_STORY_MAX_PHOTOS - photos.length;
    const batch = files.slice(0, Math.max(0, room));
    const problems: string[] = files.length > batch.length ? [`Only ${LIFE_STORY_MAX_PHOTOS} photos fit in a life story — ${files.length - batch.length} skipped.`] : [];
    setErrors([]);
    setProgress({ done: 0, total: batch.length });

    for (const original of batch) {
      try {
        const file = await compressImage(original, { maxDimension: LIFE_STORY_PHOTO_MAX_EDGE, quality: 0.86 });
        if (file.type !== "image/jpeg" && file.type !== "image/png") throw new Error("this format couldn't be converted — try a JPEG");
        const signed = await requestPhotoUploadAction(eventId, file.type, file.size);
        if (!signed.success) throw new Error(signed.error);
        const { error } = await supabaseBrowser().storage.from("gallery").uploadToSignedUrl(signed.data.path, signed.data.token, file, { contentType: file.type });
        if (error) throw new Error(error.message);
        const size = await dimensions(file);
        const saved = await confirmPhotoUploadAction(eventId, { path: signed.data.path, fileSize: file.size, ...size, caption: "" });
        if (!saved.success) throw new Error(saved.error);
        setPhotos((list) => [...list, saved.data]);
        setCoverId((c) => c ?? saved.data.id);
      } catch (err) {
        problems.push(`${original.name}: ${err instanceof Error ? err.message : "upload failed"}`);
      }
      setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
    }
    setErrors(problems);
    setProgress(null);
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }

  async function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= photos.length) return;
    const next = [...photos];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setPhotos(next);
    const res = await reorderPhotosAction(eventId, next.map((p) => p.id));
    if (!res.success) setErrors([res.error]);
  }

  async function remove(photo: LifeStoryPhoto) {
    if (!window.confirm("Delete this photo from the life story?")) return;
    const res = await deletePhotoAction(eventId, photo.id);
    if (!res.success) {
      setErrors([res.error]);
      return;
    }
    setPhotos((list) => list.filter((p) => p.id !== photo.id));
    router.refresh();
  }

  async function saveField(photo: LifeStoryPhoto, field: "caption" | "yearLabel", value: string) {
    if (photo[field] === value) return;
    setPhotos((list) => list.map((p) => (p.id === photo.id ? { ...p, [field]: value } : p)));
    const res = await updatePhotoAction(eventId, photo.id, { [field]: value });
    if (!res.success) setErrors([res.error]);
  }

  async function makeCover(photo: LifeStoryPhoto) {
    setCoverId(photo.id);
    const res = await setCoverPhotoAction(eventId, photo.id);
    if (!res.success) setErrors([res.error]);
  }

  return (
    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg text-navy-950">Photos</h2>
          <p className={hint}>
            {photos.length} of {LIFE_STORY_MAX_PHOTOS}. Childhood to today — the AI looks at each one and places it in the right
            chapter. Captions you add here help it.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="sr-only"
            id="life-story-photos"
            onChange={(e) => e.target.files?.length && upload(Array.from(e.target.files))}
          />
          <Button type="button" onClick={() => fileRef.current?.click()} disabled={Boolean(progress)}>
            {progress ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {progress ? `Uploading ${progress.done + 1} of ${progress.total}…` : "Add photos"}
          </Button>
          {photos.length > 0 ? (
            <Button type="button" variant="outline" onClick={onDone}>
              Next: write the biography
            </Button>
          ) : null}
        </div>
      </div>

      {errors.length ? (
        <ul className={`mt-3 space-y-1 ${errorText}`}>
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}

      {photos.length === 0 ? (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="mt-5 w-full rounded-lg border border-dashed border-navy-950/15 py-12 text-center text-sm text-navy-700/50 hover:border-gold-500"
        >
          Choose photos from your computer or phone (JPEG, PNG, HEIC)
        </button>
      ) : (
        <ul className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo, i) => (
            <li key={photo.id} className="overflow-hidden rounded-lg border border-navy-950/10">
              <div className="relative aspect-[4/3] bg-ivory-100">
                <img src={photo.url} alt={photo.caption || `Photo ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
                <button
                  type="button"
                  onClick={() => makeCover(photo)}
                  aria-label={coverId === photo.id ? "Cover photo" : "Use as cover photo"}
                  title={coverId === photo.id ? "Cover photo" : "Use as cover photo"}
                  className={cn(
                    "absolute left-2 top-2 rounded-full p-1.5 shadow",
                    coverId === photo.id ? "bg-gold-500 text-white" : "bg-white/85 text-navy-700 hover:bg-white",
                  )}
                >
                  <Star className="h-3.5 w-3.5" fill={coverId === photo.id ? "currentColor" : "none"} />
                </button>
              </div>
              <div className="space-y-1.5 p-2">
                <input
                  aria-label="Caption"
                  placeholder="Caption"
                  defaultValue={photo.caption}
                  onBlur={(e) => saveField(photo, "caption", e.target.value)}
                  className={`${input} px-2 py-1 text-xs`}
                />
                <input
                  aria-label="Year"
                  placeholder="Year"
                  defaultValue={photo.yearLabel}
                  onBlur={(e) => saveField(photo, "yearLabel", e.target.value)}
                  className={`${input} px-2 py-1 text-xs`}
                />
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    <button type="button" aria-label="Move earlier" onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1 text-navy-700/60 hover:bg-ivory-100 disabled:opacity-30">
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Move later"
                      onClick={() => move(i, 1)}
                      disabled={i === photos.length - 1}
                      className="rounded p-1 text-navy-700/60 hover:bg-ivory-100 disabled:opacity-30"
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <button type="button" aria-label="Delete photo" onClick={() => remove(photo)} className="rounded p-1 text-red-700/70 hover:bg-red-50">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

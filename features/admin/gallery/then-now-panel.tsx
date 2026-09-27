"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowRight, Loader2, Plus, Trash2, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { GalleryPairRecord, GalleryPhotoRecord } from "@/types/content";
import { createGalleryPairAction, deleteGalleryPairAction } from "@/features/admin/gallery/story-actions";

/**
 * Admin "Then & Now": pick an old photo, then a recent one of the same
 * people/place, add an optional caption — the public gallery shows each
 * pair as a drag-to-compare slider (features/gallery/then-now-card.tsx).
 */
export function ThenNowPanel({
  eventId,
  photos,
  initialPairs,
}: {
  eventId: string;
  photos: GalleryPhotoRecord[];
  initialPairs: GalleryPairRecord[];
}) {
  const [pairs, setPairs] = useState(initialPairs);
  const [picking, setPicking] = useState(false);
  const [thenId, setThenId] = useState<string | null>(null);
  const [nowId, setNowId] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const byId = new Map(photos.map((p) => [p.id, p]));

  function pick(id: string) {
    if (!thenId || (thenId && nowId)) {
      setThenId(id);
      setNowId(null);
    } else if (id !== thenId) {
      setNowId(id);
    }
  }

  function reset() {
    setPicking(false);
    setThenId(null);
    setNowId(null);
    setCaption("");
    setError(null);
  }

  async function save() {
    if (!thenId || !nowId) return;
    setBusy(true);
    setError(null);
    const result = await createGalleryPairAction(eventId, thenId, nowId, caption.trim());
    setBusy(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    const thenPhoto = byId.get(thenId);
    const nowPhoto = byId.get(nowId);
    if (thenPhoto && nowPhoto) {
      setPairs((prev) => [...prev, { id: `new-${Date.now()}`, thenPhoto, nowPhoto, caption: caption.trim() || null }]);
    }
    reset();
  }

  async function remove(pairId: string) {
    if (!confirm("Remove this Then & Now pair? The photos themselves stay in the gallery.")) return;
    if (pairId.startsWith("new-")) {
      window.location.reload();
      return;
    }
    const result = await deleteGalleryPairAction(eventId, pairId);
    if (result.success) setPairs((prev) => prev.filter((p) => p.id !== pairId));
    else alert(result.error);
  }

  const thumb = (photo: GalleryPhotoRecord | undefined, size = 56) =>
    photo ? (
      <Image src={photo.url} alt="" width={size} height={size} className="rounded object-cover" style={{ width: size, height: size }} />
    ) : (
      <span className="block rounded bg-navy-950/5" style={{ width: size, height: size }} />
    );

  return (
    <div className="mt-6 rounded-xl border border-navy-950/10 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-navy-950">Then &amp; Now</p>
          <p className="mt-0.5 text-xs text-navy-700/60">
            Pair an old photo with a recent one — guests drag a slider to compare them.
          </p>
        </div>
        {!picking ? (
          <button
            type="button"
            onClick={() => setPicking(true)}
            disabled={photos.length < 2}
            className="flex items-center gap-1.5 rounded-lg bg-navy-950 px-3 py-2 text-xs font-medium text-ivory-50 disabled:opacity-50"
          >
            <Plus size={14} /> New pair
          </button>
        ) : null}
      </div>

      {pairs.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-3">
          {pairs.map((pair) => (
            <li key={pair.id} className="flex items-center gap-2 rounded-lg border border-navy-950/10 p-2">
              {thumb(pair.thenPhoto, 44)}
              <ArrowRight size={14} className="text-navy-700/40" />
              {thumb(pair.nowPhoto, 44)}
              <span className="max-w-40 truncate text-xs text-navy-700/80">{pair.caption ?? "No caption"}</span>
              <button type="button" onClick={() => remove(pair.id)} aria-label="Remove pair" className="p-1 text-navy-700/50 hover:text-red-600">
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {picking ? (
        <div className="mt-4 rounded-lg border border-gold-500/30 bg-gold-500/5 p-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-navy-700">
              <span className="font-medium">Then</span> {thumb(thenId ? byId.get(thenId) : undefined)}
              <ArrowRight size={14} />
              <span className="font-medium">Now</span> {thumb(nowId ? byId.get(nowId) : undefined)}
            </div>
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={200}
              placeholder="Caption (optional) — e.g. The same smile, 50 years apart"
              className="min-w-56 flex-1 rounded-lg border border-navy-950/15 bg-white px-3 py-2 text-xs"
            />
            <button
              type="button"
              onClick={save}
              disabled={!thenId || !nowId || busy}
              className="flex items-center gap-1.5 rounded-lg bg-gold-500 px-3 py-2 text-xs font-medium text-navy-950 disabled:opacity-50"
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Save pair
            </button>
            <button type="button" onClick={reset} className="flex items-center gap-1 text-xs text-navy-700/70">
              <X size={13} /> Cancel
            </button>
          </div>
          <p className="mt-3 text-xs text-navy-700/70">
            {!thenId ? "Tap the OLD photo…" : !nowId ? "…now tap the RECENT photo." : "Ready — add a caption and save."}
          </p>
          {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
          <div className="mt-3 grid max-h-80 grid-cols-5 gap-2 overflow-y-auto sm:grid-cols-8 lg:grid-cols-10">
            {photos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => pick(photo.id)}
                aria-label={photo.caption ?? "Photo"}
                className={cn(
                  "relative aspect-square overflow-hidden rounded border-2",
                  photo.id === thenId ? "border-navy-950" : photo.id === nowId ? "border-gold-500" : "border-transparent",
                )}
              >
                <Image src={photo.url} alt="" fill sizes="96px" className="object-cover" />
                {photo.id === thenId || photo.id === nowId ? (
                  <span className="absolute inset-x-0 bottom-0 bg-navy-950/80 text-[10px] uppercase text-ivory-50">
                    {photo.id === thenId ? "Then" : "Now"}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

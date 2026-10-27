"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { hashPendingPhotosAction, listSimilarPhotosAction } from "@/features/admin/photo-duplicates/actions";
import { deleteGalleryPhotoAction } from "@/features/admin/gallery/actions";
import { removeMilestonePhotoAction } from "@/features/admin/timeline/actions";
import type { SimilarGroup, SimilarPhoto } from "@/services/photo-hashes";

/** Groups listed at once — a big import can have hundreds. */
const SHOW_GROUPS = 30;

/**
 * Look-alike photos across the Gallery and Timeline. On open it hashes any
 * photos not checked yet (small batches, so a big timeline just takes a
 * little while), then lists each group: the Big Screen shows one photo per
 * group (lib/photo-similarity.ts), and the host can remove the extras.
 */
export function SimilarPhotosPanel({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [remaining, setRemaining] = useState<number | null>(null);
  const [groups, setGroups] = useState<SimilarGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const loadGroups = useCallback(async () => {
    const result = await listSimilarPhotosAction(eventId);
    if (result.success) setGroups(result.data);
    else setError(result.error);
  }, [eventId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (;;) {
        const result = await hashPendingPhotosAction(eventId);
        if (cancelled) return;
        if (!result.success) {
          setError(result.error);
          return;
        }
        setRemaining(result.data.remaining);
        if (result.data.remaining === 0 || result.data.hashed === 0) break;
      }
      await loadGroups();
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, loadGroups]);

  async function remove(photo: SimilarPhoto) {
    if (!photo.remove) return;
    const recycle = photo.remove.kind === "gallery" ? " It goes to the Recycle Bin for 30 days." : "";
    if (!confirm(`Remove this photo from ${photo.label}?${recycle}`)) return;
    setBusyKey(photo.key);
    const result = photo.remove.kind === "gallery"
      ? await deleteGalleryPhotoAction(photo.remove.id)
      : await removeMilestonePhotoAction(photo.remove.id);
    setBusyKey(null);
    if (!result.success) {
      setError(result.error);
      return;
    }
    await loadGroups();
    router.refresh();
  }

  const checking = groups === null && !error;
  const skipped = groups?.reduce((sum, g) => sum + g.photos.filter((p) => !p.shown).length, 0) ?? 0;

  return (
    <section className="mt-10 rounded-xl border border-navy-950/10 bg-white p-4 sm:p-5" aria-labelledby="similar-photos-heading">
      <div className="flex items-start gap-3">
        <Copy size={18} className="mt-0.5 shrink-0 text-gold-600" aria-hidden />
        <div className="min-w-0">
          <h2 id="similar-photos-heading" className="font-display text-lg text-navy-950">Look-alike photos</h2>
          <p className="mt-1 text-sm text-navy-700/60">
            Copies of the same picture (a re-sent or resized copy, a burst of near-identical shots) across your Gallery and
            Timeline. The Big Screen shows just one from each group; every milestone&apos;s cover is always shown.
          </p>
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-red-600" role="alert">{error}</p> : null}

      {checking ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-navy-700/70" role="status">
          <Loader2 size={14} className="animate-spin" />
          {remaining ? `Checking photos for look-alikes… ${remaining} left` : "Checking photos for look-alikes…"}
          {remaining && remaining > 50 ? <span className="text-navy-700/40">— you can leave; it carries on next time.</span> : null}
        </p>
      ) : null}

      {groups && groups.length === 0 ? <p className="mt-4 text-sm text-navy-700/70">No look-alike photos found.</p> : null}

      {groups && groups.length > 0 ? (
        <>
          <p className="mt-4 text-sm text-navy-950" role="status">
            {groups.length} {groups.length === 1 ? "group" : "groups"} of look-alike photos — the Big Screen skips {skipped}{" "}
            {skipped === 1 ? "repeat" : "repeats"}.
          </p>
          <ul className="mt-3 space-y-3">
            {groups.slice(0, SHOW_GROUPS).map((group) => (
              <li key={group.photos[0]!.key} className="rounded-lg border border-navy-950/10 p-3">
                <p className="text-[11px] font-medium uppercase tracking-widest text-navy-700/50">
                  {group.identical ? "Identical" : "Look alike"} · {group.photos.length} photos
                </p>
                <div className="mt-2 flex gap-3 overflow-x-auto pb-1">
                  {group.photos.map((photo) => (
                    <figure key={photo.key} className="w-28 shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.url}
                        alt={photo.label}
                        loading="lazy"
                        className={cn("aspect-square w-full rounded object-cover", !photo.shown && "opacity-60")}
                      />
                      <figcaption className="mt-1 space-y-1">
                        <span
                          className={cn(
                            "inline-block rounded-full px-2 py-0.5 text-[10px] font-medium",
                            photo.shown ? "bg-gold-500/15 text-navy-950" : "bg-navy-950/5 text-navy-700/70",
                          )}
                        >
                          {photo.shown ? "Shown" : "Skipped on Big Screen"}
                        </span>
                        <span className="line-clamp-2 block text-[11px] text-navy-700/70">{photo.label}</span>
                        {photo.remove ? (
                          <button
                            type="button"
                            onClick={() => remove(photo)}
                            disabled={busyKey !== null}
                            aria-label={`Remove this photo from ${photo.label}`}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600 hover:underline disabled:opacity-50"
                          >
                            {busyKey === photo.key ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                            Remove
                          </button>
                        ) : null}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          {groups.length > SHOW_GROUPS ? (
            <p className="mt-3 text-xs text-navy-700/50">
              Showing {SHOW_GROUPS} of {groups.length} groups — remove some to see the rest.
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

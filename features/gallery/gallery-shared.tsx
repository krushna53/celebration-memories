"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Check, Loader2, Pause, Pencil, Play } from "lucide-react";
import { PhotoSlider } from "react-photo-view";
import "react-photo-view/dist/react-photo-view.css";

import { isVideoMedia } from "@/lib/curated-media";
import { cn } from "@/lib/utils";
import { CHAPTERS, CHAPTER_TITLE_MAX, type GalleryCategory } from "@/features/gallery/gallery-data";
import { canEditGalleryAction, renameGalleryChapterAction } from "@/features/gallery/actions";
import type { GalleryPhotoRecord, GuestGalleryPhoto } from "@/types/content";
import { MediaShareButtons } from "@/components/media/media-share-buttons";

/**
 * Pieces shared by the event page's Gallery section
 * (features/gallery/gallery-section.tsx) and the full-page gallery at
 * /events/[slug]/gallery (features/gallery/full-gallery.tsx): chapter
 * order, the masonry and square grids, and the lightbox/slideshow.
 */

export const SLIDESHOW_INTERVAL_MS = 3500;


/** "…, 1970s" in a caption (the AI tagger adds these for old prints) → 1970; photos without one sort after dated ones. */
function decadeOf(caption: string | null): number {
  const match = caption?.match(/\b(1[89]\d0|20\d0)s\b/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}
export function chronological(list: GalleryPhotoRecord[]): GalleryPhotoRecord[] {
  return [...list].sort((a, b) => decadeOf(a.caption) - decadeOf(b.caption) || a.sortOrder - b.sortOrder);
}

/** A chapter's name for this event — the host's own if they renamed it, otherwise the default. */
export function chapterTitle(category: GalleryCategory, titles?: Record<string, string> | null): string {
  return titles?.[category] ?? CHAPTERS.find((c) => c.category === category)?.title ?? category;
}

/** Photos grouped into chapters, in story order, empty chapters dropped. */
export function toChapters(photos: GalleryPhotoRecord[], titles?: Record<string, string> | null) {
  return CHAPTERS.map((c) => ({
    ...c,
    title: chapterTitle(c.category, titles),
    photos: chronological(photos.filter((p) => p.category === c.category)),
  })).filter((c) => c.photos.length > 0);
}

/**
 * Whether the signed-in visitor (if any) may rename this event's gallery
 * chapters — checked from the browser because event pages are cached for
 * everyone. False for guests, false while checking.
 */
export function useCanEditGallery(eventId: string | undefined): boolean {
  const [canEdit, setCanEdit] = useState(false);
  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    canEditGalleryAction(eventId)
      .then((ok) => {
        if (!cancelled) setCanEdit(ok);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [eventId]);
  return canEdit;
}

/**
 * A chapter heading with an inline rename (pencil → field → Save/Cancel)
 * for hosts. Everyone else just sees the title.
 */
export function EditableChapterTitle({
  eventId,
  category,
  title,
  canEdit,
  onRenamed,
  className,
}: {
  eventId?: string;
  category: GalleryCategory;
  title: string;
  canEdit: boolean;
  onRenamed: (category: GalleryCategory, title: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!editing || !eventId) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className={className}>{title}</span>
        {canEdit && eventId ? (
          <button
            type="button"
            onClick={() => {
              setValue(title);
              setError(null);
              setEditing(true);
            }}
            aria-label={`Rename “${title}”`}
            title="Rename this chapter (only you can see this)"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-navy-700 ring-1 ring-inset ring-navy-950/20 transition-luxury duration-200 hover:text-navy-950 hover:ring-navy-950/50"
          >
            <Pencil size={14} />
          </button>
        ) : null}
      </span>
    );
  }

  async function save() {
    setSaving(true);
    setError(null);
    const result = await renameGalleryChapterAction(eventId!, category, value);
    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onRenamed(category, result.data.title);
    setEditing(false);
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <input
        autoFocus
        value={value}
        maxLength={CHAPTER_TITLE_MAX}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void save();
          if (e.key === "Escape") setEditing(false);
        }}
        aria-label="Chapter name"
        placeholder={CHAPTERS.find((c) => c.category === category)?.title}
        className="w-56 rounded-lg bg-white px-3 py-1.5 text-base text-navy-950 ring-1 ring-inset ring-navy-950/25 focus:outline-none focus:ring-2 focus:ring-gold-500"
      />
      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="inline-flex items-center gap-1 rounded-full bg-navy-950 px-3 py-1.5 text-xs font-medium text-ivory-50 disabled:opacity-60"
      >
        {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Save
      </button>
      <button type="button" onClick={() => setEditing(false)} className="text-xs text-navy-700/70 hover:text-navy-950">
        Cancel
      </button>
      <span className="w-full text-[11px] text-navy-700/60">
        {error ?? "Leave empty to go back to the default name."}
      </span>
    </span>
  );
}

/** One photo the lightbox can show — family photos and guest photos alike. */
export interface ViewerItem {
  id: string;
  url: string;
  caption: string | null;
  shareBase: string;
  pageUrl?: string;
  byline?: string;
}

export function toViewer(p: GalleryPhotoRecord): ViewerItem {
  return { id: p.id, url: p.url, caption: p.caption, shareBase: `gallery-${p.category}`, pageUrl: `/p/gallery/${p.id}` };
}

export function guestToViewer(g: GuestGalleryPhoto): ViewerItem {
  return { id: `guest-${g.id}`, url: g.url, caption: g.caption, shareBase: "guest-photo", byline: `Shared by ${g.authorName}` };
}

/**
 * Column count for the masonry grid, tracked in JS (not CSS `columns`) so
 * photos are dealt into columns row by row and keep their reading order.
 * `breakpoints` maps a min-width to a column count, e.g. {640: 3, 1024: 4}.
 */
export function useColumnCount(base: number, breakpoints: Record<number, number>): number {
  const [count, setCount] = useState(base);
  useEffect(() => {
    const entries = Object.entries(breakpoints)
      .map(([w, n]) => [Number(w), n] as const)
      .sort((a, b) => a[0] - b[0]);
    const queries = entries.map(([w]) => window.matchMedia(`(min-width: ${w}px)`));
    const update = () => {
      let next = base;
      queries.forEach((q, i) => {
        if (q.matches) next = entries[i]![1];
      });
      setCount(next);
    };
    update();
    queries.forEach((q) => q.addEventListener("change", update));
    return () => queries.forEach((q) => q.removeEventListener("change", update));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- breakpoints are static per call site
  }, [base]);
  return count;
}

function Tile({ item, onOpen, square }: { item: ViewerItem; onOpen: () => void; square: boolean }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open media${item.caption ? `: ${item.caption}` : ""}`}
      className={cn(
        "group relative block w-full cursor-zoom-in overflow-hidden text-left",
        square ? "aspect-square bg-navy-950/5" : "rounded-xl border border-navy-950/5",
      )}
    >
      {isVideoMedia(item.url) ? (
        <div className={cn("relative bg-black", square ? "h-full w-full" : "")}>
          <video
            src={item.url}
            muted
            playsInline
            preload="metadata"
            className={square ? "h-full w-full object-cover" : "aspect-video w-full"}
          />
          <span className="absolute inset-0 flex items-center justify-center text-white">
            <Play size={square ? 28 : 36} />
          </span>
        </div>
      ) : (
        <Image
          src={item.url}
          alt={item.caption ?? ""}
          width={600}
          height={800}
          loading="lazy"
          sizes={square ? "(min-width: 1024px) 16vw, (min-width: 640px) 25vw, 33vw" : "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"}
          className={cn(
            "w-full object-cover transition-luxury duration-500 group-hover:scale-105",
            square ? "h-full" : "h-auto",
          )}
        />
      )}
      {item.byline ? (
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy-950/70 to-transparent px-3 pb-2 pt-6 text-xs text-ivory-50">
          {item.byline}
        </span>
      ) : null}
    </button>
  );
}

/** Pinterest-style masonry: natural heights, dealt into columns in reading order. */
export function MasonryGrid({
  entries,
  columnCount,
  onOpen,
}: {
  entries: { item: ViewerItem; index: number }[];
  columnCount: number;
  onOpen: (index: number) => void;
}) {
  const columns = Array.from({ length: columnCount }, (_, c) => entries.filter((_, i) => i % columnCount === c));
  return (
    <div className="flex gap-3 sm:gap-4">
      {columns.map((column, c) => (
        <div key={c} className="flex min-w-0 flex-1 flex-col gap-3 sm:gap-4">
          {column.map(({ item, index }) => (
            <Tile key={item.id} item={item} onOpen={() => onOpen(index)} square={false} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Google Photos-style: tight square tiles, edge to edge. */
export function SquareGrid({
  entries,
  onOpen,
}: {
  entries: { item: ViewerItem; index: number }[];
  onOpen: (index: number) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-0.5 sm:grid-cols-4 sm:gap-1 lg:grid-cols-6">
      {entries.map(({ item, index }) => (
        <Tile key={item.id} item={item} onOpen={() => onOpen(index)} square />
      ))}
    </div>
  );
}

/** Current window size, kept up to date on resize/rotation — sizes the lightbox's video box. */
function useViewportSize() {
  const [size, setSize] = useState({ width: 960, height: 540 });
  useEffect(() => {
    const update = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return size;
}

/** Full-screen viewer with share/download and a Play/Pause slideshow. */
export function GalleryLightbox({
  viewer,
  playing,
  setPlaying,
  onIndexChange,
  onClose,
}: {
  viewer: { items: ViewerItem[]; index: number } | null;
  playing: boolean;
  setPlaying: (next: boolean | ((p: boolean) => boolean)) => void;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const current = viewer ? viewer.items[viewer.index] : null;
  const viewport = useViewportSize();

  // Auto-advance while playing (videos play out instead of being skipped).
  useEffect(() => {
    if (!playing || !viewer || viewer.items.length < 2 || isVideoMedia(viewer.items[viewer.index]?.url)) return;
    const timer = window.setTimeout(() => onIndexChange((viewer.index + 1) % viewer.items.length), SLIDESHOW_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [playing, viewer, onIndexChange]);

  return (
    <PhotoSlider
      images={(viewer?.items ?? []).map((item, index) =>
        isVideoMedia(item.url)
          ? {
              key: item.id,
              // The box is the whole screen and the video letterboxes inside it,
              // so portrait phone clips and landscape videos both show in full.
              // (A fixed 16:9 box without the library's `attrs` placed portrait
              // videos off-centre and cropped.)
              width: viewport.width,
              height: viewport.height,
              render: ({ attrs }) =>
                index === viewer?.index ? (
                  <div {...attrs}>
                    <video
                      key={item.id}
                      src={item.url}
                      controls
                      playsInline
                      preload="metadata"
                      aria-label={item.caption || "Gallery video"}
                      className="h-full w-full bg-black object-contain"
                    />
                  </div>
                ) : null,
            }
          : { key: item.id, src: item.url },
      )}
      visible={viewer !== null}
      index={viewer?.index ?? 0}
      onIndexChange={(index) => {
        setPlaying(false);
        onIndexChange(index);
      }}
      onClose={onClose}
      toolbarRender={() => (
        <div className="flex items-center gap-1.5">
          {viewer && viewer.items.length > 1 ? (
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? "Pause slideshow" : "Play slideshow"}
              className="tap-target flex items-center justify-center rounded-full bg-navy-950/70 p-2 text-ivory-50 backdrop-blur-sm transition-luxury duration-200 hover:bg-navy-950"
            >
              {playing ? <Pause size={15} /> : <Play size={15} />}
            </button>
          ) : null}
          {current ? (
            <MediaShareButtons
              url={current.url}
              fileNameBase={current.shareBase}
              shareText={current.caption ?? undefined}
              pageUrl={current.pageUrl}
              className="flex gap-1.5"
            />
          ) : null}
        </div>
      )}
      overlayRender={() =>
        current?.caption || current?.byline ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] bg-gradient-to-t from-black/70 to-transparent px-6 pb-8 pt-16 text-center text-ivory-50">
            {current.caption ? <p className="font-display text-lg">{current.caption}</p> : null}
            {current.byline ? <p className="mt-1 text-xs opacity-80">{current.byline}</p> : null}
          </div>
        ) : null
      }
    />
  );
}

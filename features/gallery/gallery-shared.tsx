"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Pause, Play } from "lucide-react";
import { PhotoSlider } from "react-photo-view";
import "react-photo-view/dist/react-photo-view.css";

import { isVideoMedia } from "@/lib/curated-media";
import { cn } from "@/lib/utils";
import type { GalleryCategory } from "@/features/gallery/gallery-data";
import type { GalleryPhotoRecord, GuestGalleryPhoto } from "@/types/content";
import { MediaShareButtons } from "@/components/media/media-share-buttons";

/**
 * Pieces shared by the event page's Gallery section
 * (features/gallery/gallery-section.tsx) and the full-page gallery at
 * /events/[slug]/gallery (features/gallery/full-gallery.tsx): chapter
 * order, the masonry and square grids, and the lightbox/slideshow.
 */

export const SLIDESHOW_INTERVAL_MS = 3500;

/** A life story reads oldest → newest: chapter order and titles per category. */
export const CHAPTERS: { category: GalleryCategory; title: string }[] = [
  { category: "childhood", title: "The early years" },
  { category: "wedding", title: "The wedding" },
  { category: "family", title: "Family" },
  { category: "travel", title: "Travels" },
  { category: "friends", title: "Friends" },
  { category: "grandchildren", title: "The little ones" },
];

/** "…, 1970s" in a caption (the AI tagger adds these for old prints) → 1970; photos without one sort after dated ones. */
function decadeOf(caption: string | null): number {
  const match = caption?.match(/\b(1[89]\d0|20\d0)s\b/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}
export function chronological(list: GalleryPhotoRecord[]): GalleryPhotoRecord[] {
  return [...list].sort((a, b) => decadeOf(a.caption) - decadeOf(b.caption) || a.sortOrder - b.sortOrder);
}

/** Photos grouped into chapters, in story order, empty chapters dropped. */
export function toChapters(photos: GalleryPhotoRecord[]) {
  return CHAPTERS.map((c) => ({ ...c, photos: chronological(photos.filter((p) => p.category === c.category)) })).filter(
    (c) => c.photos.length > 0,
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
              width: 960,
              height: 540,
              render: () =>
                index === viewer?.index ? (
                  <video
                    key={item.id}
                    src={item.url}
                    controls
                    playsInline
                    preload="metadata"
                    aria-label={item.caption || "Gallery video"}
                    className="h-full w-full bg-black object-contain"
                  />
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

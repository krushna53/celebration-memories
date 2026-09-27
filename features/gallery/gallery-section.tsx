"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { ChevronDown, ImageOff, Pause, Play } from "lucide-react";
import { PhotoSlider } from "react-photo-view";
import "react-photo-view/dist/react-photo-view.css";

import { cn } from "@/lib/utils";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/motion/reveal";
import { GALLERY_CATEGORIES, type GalleryCategory } from "@/features/gallery/gallery-data";
import type { GalleryPhotoRecord } from "@/types/content";
import { MediaShareButtons } from "@/components/media/media-share-buttons";

interface GallerySectionProps {
  photos: GalleryPhotoRecord[];
}

/** Cover + this many more before "See all" — keeps the section to about one screen on a phone. */
const HIGHLIGHT_COUNT = 9;
const SLIDESHOW_INTERVAL_MS = 3500;

/**
 * Two columns on phones, three from `sm` up — tracked in JS (not CSS
 * `columns`) so photos can be dealt into columns row by row: CSS columns
 * fill top-to-bottom, which scattered the admin's sort order (and any
 * chronology) across the page.
 */
function useColumnCount(): number {
  const [count, setCount] = useState(2);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 640px)");
    const update = () => setCount(query.matches ? 3 : 2);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return count;
}

/**
 * Photo gallery: a large cover photo plus a short highlight grid, with
 * "See all" to expand; category filters show only categories that
 * actually have photos (with counts); a full-screen lightbox holds the
 * share/download buttons and a "Play slideshow" mode. Photos come from
 * admin-curated `gallery_photos` (see /admin/gallery), in their admin
 * sort order.
 */
export function GallerySection({ photos }: GallerySectionProps) {
  const [active, setActive] = useState<GalleryCategory | "all">("all");
  const [expanded, setExpanded] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const columnCount = useColumnCount();

  // Only categories that have photos get a filter pill.
  const categories = useMemo(() => {
    const counts = new Map<GalleryCategory, number>();
    for (const photo of photos) counts.set(photo.category, (counts.get(photo.category) ?? 0) + 1);
    return GALLERY_CATEGORIES.filter((c) => c.value !== "all" && counts.has(c.value)).map((c) => ({
      ...c,
      count: counts.get(c.value as GalleryCategory) ?? 0,
    }));
  }, [photos]);
  const showFilters = categories.length > 1;

  const items = useMemo(
    () => (active === "all" ? photos : photos.filter((photo) => photo.category === active)),
    [active, photos],
  );
  const [cover, ...rest] = items;
  const visibleRest = expanded ? rest : rest.slice(0, HIGHLIGHT_COUNT - 1);
  const hiddenCount = rest.length - visibleRest.length;

  // Deal the grid photos into columns row by row, keeping each photo's index in `items` for the lightbox.
  const columns = useMemo(() => {
    const cols: { photo: GalleryPhotoRecord; index: number }[][] = Array.from({ length: columnCount }, () => []);
    visibleRest.forEach((photo, i) => cols[i % columnCount]?.push({ photo, index: i + 1 }));
    return cols;
  }, [visibleRest, columnCount]);

  // The lightbox browses every photo in the current filter, not just the visible highlights.
  const sliderImages = useMemo(() => items.map((photo) => ({ key: photo.id, src: photo.url })), [items]);

  useEffect(() => {
    if (!playing || viewerIndex === null || items.length < 2) return;
    const timer = window.setTimeout(() => setViewerIndex((viewerIndex + 1) % items.length), SLIDESHOW_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [playing, viewerIndex, items.length]);

  function selectCategory(value: GalleryCategory | "all") {
    setActive(value);
    setExpanded(false);
  }

  function openViewer(index: number, autoplay = false) {
    setPlaying(autoplay);
    setViewerIndex(index);
  }

  function closeViewer() {
    setPlaying(false);
    setViewerIndex(null);
  }

  const tileLabel = (index: number) =>
    `Open photo ${index + 1} of ${items.length}${items[index]?.caption ? `: ${items[index]?.caption}` : ""}`;

  return (
    <section id="gallery" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <SectionHeading
            eyebrow="Cherished Moments"
            title="Gallery"
            description="A lifetime of memories, shared by the family."
          />
        </Reveal>

        {photos.length > 0 ? (
          <Reveal delay={0.1}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
              {showFilters ? (
                <div className="flex flex-wrap items-center justify-center gap-2" role="tablist" aria-label="Gallery categories">
                  {[{ value: "all" as const, label: "All", count: photos.length }, ...categories].map((category) => (
                    <button
                      key={category.value}
                      type="button"
                      role="tab"
                      aria-selected={active === category.value}
                      onClick={() => selectCategory(category.value)}
                      className={cn(
                        "rounded-full border px-4 py-1.5 text-xs uppercase tracking-[0.15em] transition-luxury duration-300 sm:text-sm",
                        active === category.value
                          ? "border-gold-500 bg-gold-500 text-navy-950"
                          : "border-navy-950/15 text-navy-700/70 hover:border-gold-400 hover:text-navy-950",
                      )}
                    >
                      {category.label} <span className="opacity-60">{category.count}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              {items.length > 1 ? (
                <button
                  type="button"
                  onClick={() => openViewer(0, true)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-navy-950/15 px-4 py-1.5 text-xs uppercase tracking-[0.15em] text-navy-700/80 transition-luxury duration-300 hover:border-gold-400 hover:text-navy-950 sm:text-sm"
                >
                  <Play size={13} /> Play slideshow
                </button>
              ) : null}
            </div>
          </Reveal>
        ) : null}

        <Reveal delay={0.2} className="mt-10">
          {!cover ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-navy-950/15 py-20 text-center text-navy-700/50">
              <ImageOff size={28} />
              <p className="text-sm">Photos are coming soon.</p>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => openViewer(0)}
                aria-label={tileLabel(0)}
                className="group relative block w-full cursor-zoom-in overflow-hidden rounded-2xl border border-navy-950/5"
              >
                <Image
                  src={cover.url}
                  alt={cover.caption ?? ""}
                  width={1200}
                  height={800}
                  sizes="(min-width: 1152px) 1104px, 100vw"
                  priority={false}
                  className="max-h-[70vh] w-full object-cover transition-luxury duration-700 group-hover:scale-[1.02]"
                />
                {cover.caption ? (
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy-950/70 to-transparent px-5 pb-4 pt-10 text-left font-display text-lg text-ivory-50">
                    {cover.caption}
                  </span>
                ) : null}
              </button>

              {visibleRest.length > 0 ? (
                <div className="mt-4 flex gap-4">
                  {columns.map((column, c) => (
                    <div key={c} className="flex min-w-0 flex-1 flex-col gap-4">
                      {column.map(({ photo, index }) => (
                        <button
                          key={photo.id}
                          type="button"
                          onClick={() => openViewer(index)}
                          aria-label={tileLabel(index)}
                          className="group relative block cursor-zoom-in overflow-hidden rounded-xl border border-navy-950/5"
                        >
                          <Image
                            src={photo.url}
                            alt={photo.caption ?? ""}
                            width={600}
                            height={800}
                            loading="lazy"
                            sizes="(min-width: 640px) 33vw, 50vw"
                            className="h-auto w-full object-cover transition-luxury duration-500 group-hover:scale-105"
                          />
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              ) : null}

              {hiddenCount > 0 ? (
                <div className="mt-8 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setExpanded(true)}
                    className="inline-flex items-center gap-2 rounded-full bg-navy-950 px-6 py-3 text-sm font-medium text-ivory-50 transition-luxury duration-300 hover:bg-navy-900"
                  >
                    See all {items.length} photos <ChevronDown size={16} />
                  </button>
                </div>
              ) : null}
            </>
          )}
        </Reveal>
      </div>

      <PhotoSlider
        images={sliderImages}
        visible={viewerIndex !== null}
        index={viewerIndex ?? 0}
        onIndexChange={setViewerIndex}
        onClose={closeViewer}
        toolbarRender={({ index }) => {
          const photo = items[index];
          return (
            <div className="flex items-center gap-1.5">
              {items.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setPlaying((p) => !p)}
                  aria-label={playing ? "Pause slideshow" : "Play slideshow"}
                  className="tap-target flex items-center justify-center rounded-full bg-navy-950/70 p-2 text-ivory-50 backdrop-blur-sm transition-luxury duration-200 hover:bg-navy-950"
                >
                  {playing ? <Pause size={15} /> : <Play size={15} />}
                </button>
              ) : null}
              {photo ? (
                <MediaShareButtons
                  url={photo.url}
                  fileNameBase={`gallery-${photo.category}`}
                  shareText={photo.caption ?? undefined}
                  pageUrl={`/p/gallery/${photo.id}`}
                  className="flex gap-1.5"
                />
              ) : null}
            </div>
          );
        }}
      />
    </section>
  );
}

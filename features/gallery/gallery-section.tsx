"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { ChevronDown, ImageOff, Pause, Play } from "lucide-react";
import { PhotoSlider } from "react-photo-view";
import "react-photo-view/dist/react-photo-view.css";

import { cn } from "@/lib/utils";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/motion/reveal";
import type { GalleryCategory } from "@/features/gallery/gallery-data";
import { ThenNowCard } from "@/features/gallery/then-now-card";
import type { GalleryPairRecord, GalleryPhotoRecord, GuestGalleryPhoto } from "@/types/content";
import { MediaShareButtons } from "@/components/media/media-share-buttons";

interface GallerySectionProps {
  photos: GalleryPhotoRecord[];
  pairs?: GalleryPairRecord[];
  guestPhotos?: GuestGalleryPhoto[];
}

/** Cover + this many more before "See all" when there's only one chapter. */
const HIGHLIGHT_COUNT = 9;
/** Photos shown per chapter before its own "See all". */
const CHAPTER_PREVIEW = 6;
const SLIDESHOW_INTERVAL_MS = 3500;

/** A life story reads oldest → newest: chapter order and titles per category. */
const CHAPTERS: { category: GalleryCategory; title: string }[] = [
  { category: "childhood", title: "The early years" },
  { category: "wedding", title: "The wedding" },
  { category: "family", title: "Family" },
  { category: "travel", title: "Travels" },
  { category: "friends", title: "Friends" },
  { category: "grandchildren", title: "The grandchildren" },
];

/** "…, 1970s" in a caption (the AI tagger adds these for old prints) → 1970; photos without one sort after dated ones. */
function decadeOf(caption: string | null): number {
  const match = caption?.match(/\b(1[89]\d0|20\d0)s\b/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}
function chronological(list: GalleryPhotoRecord[]): GalleryPhotoRecord[] {
  return [...list].sort((a, b) => decadeOf(a.caption) - decadeOf(b.caption) || a.sortOrder - b.sortOrder);
}

/**
 * Two columns on phones, three from `sm` up — tracked in JS (not CSS
 * `columns`) so photos are dealt into columns row by row and keep their
 * reading order.
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

/** One photo the lightbox can show — family photos and guest photos alike. */
interface ViewerItem {
  id: string;
  url: string;
  caption: string | null;
  shareBase: string;
  pageUrl?: string;
  byline?: string;
}

function toViewer(p: GalleryPhotoRecord): ViewerItem {
  return { id: p.id, url: p.url, caption: p.caption, shareBase: `gallery-${p.category}`, pageUrl: `/p/gallery/${p.id}` };
}

function PhotoGrid({
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
    <div className="flex gap-4">
      {columns.map((column, c) => (
        <div key={c} className="flex min-w-0 flex-1 flex-col gap-4">
          {column.map(({ item, index }) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onOpen(index)}
              aria-label={`Open photo${item.caption ? `: ${item.caption}` : ""}`}
              className="group relative block cursor-zoom-in overflow-hidden rounded-xl border border-navy-950/5 text-left"
            >
              <Image
                src={item.url}
                alt={item.caption ?? ""}
                width={600}
                height={800}
                loading="lazy"
                sizes="(min-width: 640px) 33vw, 50vw"
                className="h-auto w-full object-cover transition-luxury duration-500 group-hover:scale-105"
              />
              {item.byline ? (
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy-950/70 to-transparent px-3 pb-2 pt-6 text-xs text-ivory-50">
                  {item.byline}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Photo gallery told as a story: a cover photo, "Then & Now" compare
 * sliders, then one chapter per category (oldest first, using decades
 * from captions), each previewing a few photos with its own "See all".
 * Filter pills jump to a single chapter; a "From guests" tab shows
 * approved guest photos from the memory wall. A full-screen lightbox
 * holds share/download buttons and a "Play slideshow" mode.
 */
export function GallerySection({ photos, pairs = [], guestPhotos = [] }: GallerySectionProps) {
  const [active, setActive] = useState<GalleryCategory | "all" | "guests">("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [viewer, setViewer] = useState<{ items: ViewerItem[]; index: number } | null>(null);
  const [playing, setPlaying] = useState(false);
  const columnCount = useColumnCount();

  const chapters = useMemo(
    () =>
      CHAPTERS.map((c) => ({ ...c, photos: chronological(photos.filter((p) => p.category === c.category)) })).filter(
        (c) => c.photos.length > 0,
      ),
    [photos],
  );
  const guestItems = useMemo(
    () =>
      guestPhotos.map<ViewerItem>((g) => ({
        id: `guest-${g.id}`,
        url: g.url,
        caption: g.caption,
        shareBase: "guest-photo",
        byline: `Shared by ${g.authorName}`,
      })),
    [guestPhotos],
  );

  const tabs = [
    ...(chapters.length > 1 || guestItems.length > 0 ? [{ value: "all" as const, label: "All", count: photos.length }] : []),
    ...(chapters.length > 1 ? chapters.map((c) => ({ value: c.category, label: c.title, count: c.photos.length })) : []),
    ...(guestItems.length > 0 ? [{ value: "guests" as const, label: "From guests", count: guestItems.length }] : []),
  ];

  // What's on screen for the current tab, in reading order — this is also the lightbox/slideshow order.
  const view = useMemo(() => {
    if (active === "guests") return { cover: null, groups: [{ key: "guests", title: null, items: guestItems }] };
    if (active !== "all") {
      const chapter = chapters.find((c) => c.category === active);
      return { cover: null, groups: [{ key: active, title: null, items: (chapter?.photos ?? []).map(toViewer) }] };
    }
    const [cover, ...rest] = photos;
    if (!cover) return { cover: null, groups: [] };
    if (chapters.length <= 1) {
      return { cover: toViewer(cover), groups: [{ key: "all", title: null, items: rest.map(toViewer) }] };
    }
    return {
      cover: toViewer(cover),
      // The cover is shown once, above the chapters — a chapter left empty by that is skipped.
      groups: chapters
        .map((c) => ({ key: c.category, title: c.title, items: c.photos.filter((p) => p.id !== cover.id).map(toViewer) }))
        .filter((g) => g.items.length > 0),
    };
  }, [active, chapters, guestItems, photos]);

  const allViewItems = useMemo(
    () => [...(view.cover ? [view.cover] : []), ...view.groups.flatMap((g) => g.items)],
    [view],
  );
  let offset = view.cover ? 1 : 0;
  const groupsWithIndex = view.groups.map((g) => {
    const start = offset;
    offset += g.items.length;
    const limit = expanded[g.key]
      ? g.items.length
      : g.title
        ? CHAPTER_PREVIEW
        : active === "all"
          ? HIGHLIGHT_COUNT - 1
          : g.items.length;
    return { ...g, start, shown: g.items.slice(0, limit), hidden: Math.max(0, g.items.length - limit) };
  });

  useEffect(() => {
    if (!playing || !viewer || viewer.items.length < 2) return;
    const timer = window.setTimeout(
      () => setViewer((v) => (v ? { ...v, index: (v.index + 1) % v.items.length } : v)),
      SLIDESHOW_INTERVAL_MS,
    );
    return () => window.clearTimeout(timer);
  }, [playing, viewer]);

  function openViewer(items: ViewerItem[], index: number, autoplay = false) {
    setPlaying(autoplay);
    setViewer({ items, index });
  }
  function closeViewer() {
    setPlaying(false);
    setViewer(null);
  }
  function selectTab(value: typeof active) {
    setActive(value);
    setExpanded({});
  }

  const current = viewer ? viewer.items[viewer.index] : null;

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

        {photos.length > 0 || guestItems.length > 0 ? (
          <Reveal delay={0.1}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
              {tabs.length > 1 ? (
                <div className="flex flex-wrap items-center justify-center gap-2" role="tablist" aria-label="Gallery chapters">
                  {tabs.map((tab) => (
                    <button
                      key={tab.value}
                      type="button"
                      role="tab"
                      aria-selected={active === tab.value}
                      onClick={() => selectTab(tab.value)}
                      className={cn(
                        "rounded-full border px-4 py-1.5 text-xs uppercase tracking-[0.15em] transition-luxury duration-300 sm:text-sm",
                        active === tab.value
                          ? "border-gold-500 bg-gold-500 text-navy-950"
                          : "border-navy-950/15 text-navy-700/70 hover:border-gold-400 hover:text-navy-950",
                      )}
                    >
                      {tab.label} <span className="opacity-60">{tab.count}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              {allViewItems.length > 1 ? (
                <button
                  type="button"
                  onClick={() => openViewer(allViewItems, 0, true)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-navy-950/15 px-4 py-1.5 text-xs uppercase tracking-[0.15em] text-navy-700/80 transition-luxury duration-300 hover:border-gold-400 hover:text-navy-950 sm:text-sm"
                >
                  <Play size={13} /> Play slideshow
                </button>
              ) : null}
            </div>
          </Reveal>
        ) : null}

        <Reveal delay={0.2} className="mt-10">
          {allViewItems.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-navy-950/15 py-20 text-center text-navy-700/50">
              <ImageOff size={28} />
              <p className="text-sm">Photos are coming soon.</p>
            </div>
          ) : (
            <>
              {view.cover ? (
                <button
                  type="button"
                  onClick={() => openViewer(allViewItems, 0)}
                  aria-label={`Open photo${view.cover.caption ? `: ${view.cover.caption}` : ""}`}
                  className="group relative block w-full cursor-zoom-in overflow-hidden rounded-2xl border border-navy-950/5"
                >
                  <Image
                    src={view.cover.url}
                    alt={view.cover.caption ?? ""}
                    width={1200}
                    height={800}
                    sizes="(min-width: 1152px) 1104px, 100vw"
                    className="max-h-[70vh] w-full object-cover transition-luxury duration-700 group-hover:scale-[1.02]"
                  />
                  {view.cover.caption ? (
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy-950/70 to-transparent px-5 pb-4 pt-10 text-left font-display text-lg text-ivory-50">
                      {view.cover.caption}
                    </span>
                  ) : null}
                </button>
              ) : null}

              {active === "all" && pairs.length > 0 ? (
                <div className="mt-12">
                  <p className="text-center text-xs uppercase tracking-[0.3em] text-gold-600">Then &amp; Now</p>
                  <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {pairs.map((pair) => (
                      <ThenNowCard key={pair.id} pair={pair} />
                    ))}
                  </div>
                </div>
              ) : null}

              {groupsWithIndex.map((group) => (
                <div key={group.key} className={group.title ? "mt-14" : "mt-4"}>
                  {group.title ? (
                    <div className="mb-5 flex items-baseline justify-between gap-3 border-b border-navy-950/10 pb-3">
                      <h3 className="font-display text-2xl text-navy-950">{group.title}</h3>
                      <span className="text-xs uppercase tracking-[0.15em] text-navy-700/50">
                        {group.items.length} {group.items.length === 1 ? "photo" : "photos"}
                      </span>
                    </div>
                  ) : null}
                  {group.shown.length > 0 ? (
                    <PhotoGrid
                      entries={group.shown.map((item, i) => ({ item, index: group.start + i }))}
                      columnCount={columnCount}
                      onOpen={(index) => openViewer(allViewItems, index)}
                    />
                  ) : null}
                  {group.hidden > 0 ? (
                    <div className="mt-6 flex justify-center">
                      <button
                        type="button"
                        onClick={() => setExpanded((e) => ({ ...e, [group.key]: true }))}
                        className="inline-flex items-center gap-2 rounded-full bg-navy-950 px-6 py-3 text-sm font-medium text-ivory-50 transition-luxury duration-300 hover:bg-navy-900"
                      >
                        See all {group.items.length + (group.title ? 0 : view.cover ? 1 : 0)}
                        {group.title ? ` in ${group.title}` : " photos"} <ChevronDown size={16} />
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </>
          )}
        </Reveal>
      </div>

      <PhotoSlider
        images={(viewer?.items ?? []).map((item) => ({ key: item.id, src: item.url }))}
        visible={viewer !== null}
        index={viewer?.index ?? 0}
        onIndexChange={(index) => setViewer((v) => (v ? { ...v, index } : v))}
        onClose={closeViewer}
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
    </section>
  );
}

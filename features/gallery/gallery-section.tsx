"use client";

import { useCallback, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronDown, ImageOff, Play } from "lucide-react";

import { isVideoMedia } from "@/lib/curated-media";
import { cn } from "@/lib/utils";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/motion/reveal";
import type { GalleryCategory } from "@/features/gallery/gallery-data";
import { ThenNowCard } from "@/features/gallery/then-now-card";
import {
  EditableChapterTitle,
  GalleryLightbox,
  MasonryGrid,
  guestToViewer,
  toChapters,
  toViewer,
  useCanEditGallery,
  useColumnCount,
  type ViewerItem,
} from "@/features/gallery/gallery-shared";
import type { GalleryPairRecord, GalleryPhotoRecord, GuestGalleryPhoto } from "@/types/content";

interface GallerySectionProps {
  photos: GalleryPhotoRecord[];
  pairs?: GalleryPairRecord[];
  guestPhotos?: GuestGalleryPhoto[];
  /**
   * The event's full-page gallery (/events/[slug]/gallery). When set, a
   * chapter too big to expand inline sends "See all" there instead, and a
   * "View full gallery" link shows once the event has more photos than
   * fit comfortably on the event page.
   */
  fullGalleryHref?: string;
  /** Enables the hosts-only rename pencil next to chapter titles. */
  eventId?: string;
  /** The event's own chapter names (events.gallery_chapter_titles). */
  chapterTitles?: Record<string, string> | null;
}

/** Cover + this many more before "See all" when there's only one chapter. */
const HIGHLIGHT_COUNT = 9;
/** Photos shown per chapter before its own "See all". */
const CHAPTER_PREVIEW = 6;
/** Beyond this many photos a chapter opens on the full gallery page rather than expanding inside the event page. */
const INLINE_EXPAND_LIMIT = 24;

/**
 * Photo gallery told as a story: a cover photo, "Then & Now" compare
 * sliders, then one chapter per category (oldest first, using decades
 * from captions), each previewing a few photos with its own "See all".
 * Filter pills jump to a single chapter; a "From guests" tab shows
 * approved guest photos from the memory wall. A full-screen lightbox
 * holds share/download buttons and a "Play slideshow" mode.
 */
export function GallerySection({
  photos,
  pairs = [],
  guestPhotos = [],
  fullGalleryHref,
  eventId,
  chapterTitles = null,
}: GallerySectionProps) {
  const [titles, setTitles] = useState<Record<string, string> | null>(chapterTitles);
  const canEdit = useCanEditGallery(eventId);
  const [active, setActive] = useState<GalleryCategory | "all" | "guests">("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [viewer, setViewer] = useState<{ items: ViewerItem[]; index: number } | null>(null);
  const [playing, setPlaying] = useState(false);
  const columnCount = useColumnCount(2, { 640: 3 });

  const chapters = useMemo(() => toChapters(photos, titles), [photos, titles]);
  const guestItems = useMemo(() => guestPhotos.map<ViewerItem>(guestToViewer), [guestPhotos]);

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

  const setViewerIndex = useCallback((index: number) => setViewer((v) => (v ? { ...v, index } : v)), []);
  const totalCount = photos.length + guestItems.length;

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

        {/* The primary action, right under the title — it used to sit at the end of the chapter pills, styled like one more filter. */}
        {allViewItems.length > 1 ? (
          <Reveal delay={0.05}>
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={() => openViewer(allViewItems, 0, true)}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-gold-500 px-7 py-3 text-sm font-medium uppercase tracking-[0.15em] text-navy-950 shadow-[0_8px_24px_-8px_rgba(201,162,39,0.6)] transition-luxury duration-300 hover:bg-gold-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2"
              >
                <Play size={16} fill="currentColor" aria-hidden="true" /> Play Slideshow
              </button>
            </div>
          </Reveal>
        ) : null}

        {tabs.length > 1 ? (
          <Reveal delay={0.1}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2" role="tablist" aria-label="Gallery chapters">
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
                      ? "border-navy-950 bg-navy-950 text-ivory-50"
                      : "border-navy-950/15 text-navy-700/70 hover:border-gold-400 hover:text-navy-950",
                  )}
                >
                  {tab.label} <span className="opacity-60">{tab.count}</span>
                </button>
              ))}
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
                  aria-label={`Open media${view.cover.caption ? `: ${view.cover.caption}` : ""}`}
                  className="group relative block w-full cursor-zoom-in overflow-hidden rounded-2xl border border-navy-950/5"
                >
                  {isVideoMedia(view.cover.url) ? (
                    <div className="relative"><video src={view.cover.url} muted playsInline preload="metadata" className="max-h-[70vh] w-full bg-black" /><span className="absolute inset-0 flex items-center justify-center text-white"><Play size={48} /></span></div>
                  ) : <Image
                    src={view.cover.url}
                    alt={view.cover.caption ?? ""}
                    width={1200}
                    height={800}
                    sizes="(min-width: 1152px) 1104px, 100vw"
                    className="max-h-[70vh] w-full object-cover transition-luxury duration-700 group-hover:scale-[1.02]"
                  />}
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
                      <h3>
                        <EditableChapterTitle
                          eventId={eventId}
                          category={group.key as GalleryCategory}
                          title={group.title}
                          canEdit={canEdit}
                          onRenamed={(category, title) => setTitles((t) => ({ ...(t ?? {}), [category]: title }))}
                          className="font-display text-2xl text-navy-950"
                        />
                      </h3>
                      <span className="text-xs uppercase tracking-[0.15em] text-navy-700/50">
                        {group.items.length} {group.items.length === 1 ? "photo" : "photos"}
                      </span>
                    </div>
                  ) : null}
                  {group.shown.length > 0 ? (
                    <MasonryGrid
                      entries={group.shown.map((item, i) => ({ item, index: group.start + i }))}
                      columnCount={columnCount}
                      onOpen={(index) => openViewer(allViewItems, index)}
                    />
                  ) : null}
                  {group.hidden > 0 ? (
                    <div className="mt-6 flex justify-center">
                      {fullGalleryHref && group.items.length > INLINE_EXPAND_LIMIT ? (
                        <Link
                          href={`${fullGalleryHref}${group.key === "all" ? "" : `?chapter=${group.key}`}`}
                          className="inline-flex items-center gap-2 rounded-full bg-navy-950 px-6 py-3 text-sm font-medium text-ivory-50 transition-luxury duration-300 hover:bg-navy-900"
                        >
                          See all {group.items.length + (group.title ? 0 : view.cover ? 1 : 0)}
                          {group.title ? ` in ${group.title}` : " photos"} <ArrowRight size={16} />
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setExpanded((e) => ({ ...e, [group.key]: true }))}
                          className="inline-flex items-center gap-2 rounded-full bg-navy-950 px-6 py-3 text-sm font-medium text-ivory-50 transition-luxury duration-300 hover:bg-navy-900"
                        >
                          See all {group.items.length + (group.title ? 0 : view.cover ? 1 : 0)}
                          {group.title ? ` in ${group.title}` : " photos"} <ChevronDown size={16} />
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
              ))}

              {fullGalleryHref && totalCount > INLINE_EXPAND_LIMIT ? (
                <div className="mt-12 flex justify-center">
                  <Link
                    href={fullGalleryHref}
                    className="inline-flex items-center gap-2 rounded-full border border-navy-950/15 px-6 py-3 text-sm font-medium text-navy-950 transition-luxury duration-300 hover:border-gold-500"
                  >
                    View full gallery · {totalCount} photos &amp; videos <ArrowRight size={16} />
                  </Link>
                </div>
              ) : null}
            </>
          )}
        </Reveal>
      </div>

      <GalleryLightbox
        viewer={viewer}
        playing={playing}
        setPlaying={setPlaying}
        onIndexChange={setViewerIndex}
        onClose={closeViewer}
      />
    </section>
  );
}

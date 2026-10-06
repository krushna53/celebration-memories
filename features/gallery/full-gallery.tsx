"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Grid3x3, ImageOff, LayoutDashboard, Loader2, Play } from "lucide-react";

import { cn } from "@/lib/utils";
import type { GalleryCategory } from "@/features/gallery/gallery-data";
import {
  EditableChapterTitle,
  GalleryLightbox,
  MasonryGrid,
  SquareGrid,
  guestToViewer,
  toChapters,
  toViewer,
  useCanEditGallery,
  useColumnCount,
  type ViewerItem,
} from "@/features/gallery/gallery-shared";
import type { GalleryPhotoRecord, GuestGalleryPhoto } from "@/types/content";

type Tab = GalleryCategory | "all" | "guests";
type Layout = "mosaic" | "grid";

/** Tiles rendered per batch — more load as the visitor scrolls near the end. */
const BATCH = 48;
const LAYOUT_KEY = "em:gallery-layout";

interface Section {
  key: string;
  title: string | null;
  items: ViewerItem[];
}

/**
 * The full-page gallery at /events/[slug]/gallery — for events with more
 * photos than fit comfortably in the event page's Gallery section. Two
 * looks the visitor can switch between (remembered on this device):
 *  - Mosaic: Pinterest-style masonry, photos at their natural shape.
 *  - Grid: Google Photos-style tight square tiles under chapter headings.
 * Chapter tabs (kept in the URL as ?chapter=… so "See all in Travels" on
 * the event page lands on the right one), a slideshow over everything,
 * and tiles rendered in batches as you scroll so hundreds of photos stay
 * quick on a phone.
 */
export function FullGallery({
  eventId,
  honoreeName,
  eventHref,
  photos,
  guestPhotos,
  initialChapter,
  chapterTitles = null,
  invitationCardUrl = null,
}: {
  eventId: string;
  honoreeName: string;
  eventHref: string;
  photos: GalleryPhotoRecord[];
  guestPhotos: GuestGalleryPhoto[];
  initialChapter: string | null;
  /** The event's own chapter names (events.gallery_chapter_titles). */
  chapterTitles?: Record<string, string> | null;
  /** The event's invitation card (its link-preview image), shown in the header. */
  invitationCardUrl?: string | null;
}) {
  const [titles, setTitles] = useState<Record<string, string> | null>(chapterTitles);
  const canEdit = useCanEditGallery(eventId);
  const chapters = useMemo(() => toChapters(photos, titles), [photos, titles]);
  const guestItems = useMemo(() => guestPhotos.map(guestToViewer), [guestPhotos]);

  const validTabs = useMemo(
    () => new Set<string>(["all", ...chapters.map((c) => c.category), ...(guestItems.length ? ["guests"] : [])]),
    [chapters, guestItems.length],
  );
  const [active, setActive] = useState<Tab>(
    initialChapter && validTabs.has(initialChapter) ? (initialChapter as Tab) : "all",
  );
  const [layout, setLayout] = useState<Layout>("mosaic");
  const [visible, setVisible] = useState(BATCH);
  const [viewer, setViewer] = useState<{ items: ViewerItem[]; index: number } | null>(null);
  const [playing, setPlaying] = useState(false);
  const columnCount = useColumnCount(2, { 640: 3, 1024: 4 });
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LAYOUT_KEY);
      if (saved === "grid" || saved === "mosaic") setLayout(saved);
    } catch {
      // Storage blocked — keep the default.
    }
  }, []);

  function chooseLayout(next: Layout) {
    setLayout(next);
    try {
      localStorage.setItem(LAYOUT_KEY, next);
    } catch {
      // Not remembered this time; still switches.
    }
  }

  function selectTab(next: Tab) {
    setActive(next);
    setVisible(BATCH);
    const url = new URL(window.location.href);
    if (next === "all") url.searchParams.delete("chapter");
    else url.searchParams.set("chapter", next);
    window.history.replaceState(null, "", url);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const tabs = [
    { value: "all" as const, label: "All", count: photos.length + guestItems.length },
    ...(chapters.length > 1 ? chapters.map((c) => ({ value: c.category, label: c.title, count: c.photos.length })) : []),
    ...(guestItems.length > 0 ? [{ value: "guests" as const, label: "From guests", count: guestItems.length }] : []),
  ];

  // Everything for the current tab, grouped into headed sections, in reading (= slideshow) order.
  const sections = useMemo<Section[]>(() => {
    if (active === "guests") return [{ key: "guests", title: null, items: guestItems }];
    if (active !== "all") {
      const chapter = chapters.find((c) => c.category === active);
      return [{ key: active, title: null, items: (chapter?.photos ?? []).map(toViewer) }];
    }
    return [
      ...chapters.map((c) => ({ key: c.category, title: chapters.length > 1 ? c.title : null, items: c.photos.map(toViewer) })),
      ...(guestItems.length > 0 ? [{ key: "guests", title: "From guests", items: guestItems }] : []),
    ];
  }, [active, chapters, guestItems]);

  const allItems = useMemo(() => sections.flatMap((s) => s.items), [sections]);

  // Only the first `visible` tiles are rendered; sections are cut to fit.
  const shownSections = useMemo(() => {
    let remaining = visible;
    let start = 0;
    const out: (Section & { start: number; shown: ViewerItem[] })[] = [];
    for (const section of sections) {
      if (remaining <= 0) break;
      const shown = section.items.slice(0, remaining);
      out.push({ ...section, start, shown });
      remaining -= shown.length;
      start += section.items.length;
    }
    return out;
  }, [sections, visible]);

  const hasMore = visible < allItems.length;

  // Load the next batch when the sentinel scrolls into view.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible((v) => v + BATCH);
      },
      { rootMargin: "800px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, shownSections]);

  const setViewerIndex = useCallback((index: number) => setViewer((v) => (v ? { ...v, index } : v)), []);
  function openViewer(index: number, autoplay = false) {
    setPlaying(autoplay);
    setViewer({ items: allItems, index });
  }

  return (
    <section className="min-h-screen bg-white pb-24 pt-24 sm:pt-28">
      <div className="mx-auto max-w-7xl px-3 sm:px-6">
        <div className="px-1 sm:px-0">
          <Link
            href={`${eventHref}#gallery`}
            className="inline-flex items-center gap-1.5 text-sm text-navy-700/70 transition-luxury duration-200 hover:text-navy-950"
          >
            <ArrowLeft size={15} /> Back to the event
          </Link>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              {invitationCardUrl ? (
                <button
                  type="button"
                  onClick={() => {
                    setPlaying(false);
                    setViewer({
                      items: [{ id: "invitation-card", url: invitationCardUrl, caption: "The invitation", shareBase: "invitation-card" }],
                      index: 0,
                    });
                  }}
                  aria-label="View the invitation card"
                  className="group shrink-0 overflow-hidden rounded-lg bg-white shadow-md ring-1 ring-navy-950/10 transition-luxury duration-300 hover:-translate-y-0.5 hover:shadow-lg"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={invitationCardUrl} alt="The invitation card" className="h-24 w-auto max-w-[5.5rem] object-cover sm:h-32 sm:max-w-[7.5rem]" />
                </button>
              ) : null}
              <div>
              <p className="text-xs uppercase tracking-[0.3em] text-gold-600">{honoreeName}</p>
              <h1 className="mt-1 font-display text-3xl text-navy-950 sm:text-4xl">Gallery</h1>
              <p className="mt-1 text-sm text-navy-700/60">
                {photos.length + guestItems.length} photos &amp; videos
              </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {allItems.length > 1 ? (
                <button
                  type="button"
                  onClick={() => openViewer(0, true)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-navy-950/15 px-4 py-2 text-xs uppercase tracking-[0.15em] text-navy-700/80 transition-luxury duration-300 hover:border-gold-400 hover:text-navy-950"
                >
                  <Play size={13} /> Slideshow
                </button>
              ) : null}
              <div className="flex rounded-full border border-navy-950/15 p-0.5" role="radiogroup" aria-label="Gallery layout">
                {(
                  [
                    { value: "mosaic", label: "Mosaic", Icon: LayoutDashboard },
                    { value: "grid", label: "Grid", Icon: Grid3x3 },
                  ] as const
                ).map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={layout === value}
                    onClick={() => chooseLayout(value)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-luxury duration-200",
                      layout === value ? "bg-navy-950 text-ivory-50" : "text-navy-700/70 hover:text-navy-950",
                    )}
                  >
                    <Icon size={13} /> {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {tabs.length > 1 ? (
          <div className="sticky top-16 z-20 -mx-3 mt-6 bg-white/95 px-3 py-3 backdrop-blur sm:top-20 sm:mx-0 sm:px-0">
            <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Gallery chapters">
              {tabs.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={active === tab.value}
                  onClick={() => selectTab(tab.value)}
                  className={cn(
                    "shrink-0 rounded-full border px-4 py-1.5 text-xs uppercase tracking-[0.15em] transition-luxury duration-300 sm:text-sm",
                    active === tab.value
                      ? "border-navy-950 bg-navy-950 text-ivory-50"
                      : "border-navy-950/15 text-navy-700/70 hover:border-gold-400 hover:text-navy-950",
                  )}
                >
                  {tab.label} <span className="opacity-60">{tab.count}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {allItems.length === 0 ? (
          <div className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-navy-950/15 py-24 text-center text-navy-700/50">
            <ImageOff size={28} />
            <p className="text-sm">Photos are coming soon.</p>
          </div>
        ) : (
          shownSections.map((section) => {
            const entries = section.shown.map((item, i) => ({ item, index: section.start + i }));
            return (
              <div key={section.key} className={section.title ? "mt-10" : "mt-6"}>
                {section.title ? (
                  <div className="mb-3 flex items-baseline justify-between gap-3 px-1 sm:px-0">
                    <h2>
                      {section.key === "guests" ? (
                        <span className="font-display text-xl text-navy-950 sm:text-2xl">{section.title}</span>
                      ) : (
                        <EditableChapterTitle
                          eventId={eventId}
                          category={section.key as GalleryCategory}
                          title={section.title}
                          canEdit={canEdit}
                          onRenamed={(category, title) => setTitles((t) => ({ ...(t ?? {}), [category]: title }))}
                          className="font-display text-xl text-navy-950 sm:text-2xl"
                        />
                      )}
                    </h2>
                    <span className="text-xs uppercase tracking-[0.15em] text-navy-700/50">{section.items.length}</span>
                  </div>
                ) : null}
                {layout === "grid" ? (
                  <SquareGrid entries={entries} onOpen={(i) => openViewer(i)} />
                ) : (
                  <MasonryGrid entries={entries} columnCount={columnCount} onOpen={(i) => openViewer(i)} />
                )}
              </div>
            );
          })
        )}

        {hasMore ? (
          <div ref={sentinel} className="mt-10 flex justify-center">
            <button
              type="button"
              onClick={() => setVisible((v) => v + BATCH)}
              className="inline-flex items-center gap-2 rounded-full border border-navy-950/15 px-5 py-2.5 text-sm text-navy-700/80 hover:border-gold-400"
            >
              <Loader2 size={14} className="animate-spin" /> Loading more…
            </button>
          </div>
        ) : null}
      </div>

      <GalleryLightbox
        viewer={viewer}
        playing={playing}
        setPlaying={setPlaying}
        onIndexChange={setViewerIndex}
        onClose={() => {
          setPlaying(false);
          setViewer(null);
        }}
      />
    </section>
  );
}

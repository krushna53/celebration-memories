"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ChevronLeft, ChevronRight, List } from "lucide-react";

import { charsPerPageFor, chapterNumberWord, paginateBook, type BookPage } from "@/features/life-story/book-pages";
import type { BookData } from "@/features/life-story/book-data";
import { DownloadBookButton } from "@/features/life-story/download-book-button";
import type { LifeStoryBundle } from "@/types/life-story";
import s from "@/features/life-story/book-reader.module.css";

interface Layout {
  width: number;
  height: number;
  spread: boolean;
  fontSize: number;
  padX: number;
  padTop: number;
  padBottom: number;
}

/** Page size for the current window: a 2:3-ish book page, two side by side on wide screens. */
function measure(): Layout {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const spread = vw >= 1024 && vh >= 560;
  const height = Math.max(420, Math.min(vh - 150, 900));
  const width = Math.max(260, Math.min(spread ? (vw - 120) / 2 : vw - 24, height / 1.45, 560));
  const fontSize = width < 340 ? 15 : width < 420 ? 16 : width < 500 ? 17 : 18;
  return { width, height, spread, fontSize, padX: width * 0.1, padTop: height * 0.075, padBottom: height * 0.09 };
}

const Ornament = () => (
  <svg className={s.ornament} viewBox="0 0 84 12" aria-hidden>
    <path d="M0 6h32M52 6h32" stroke="currentColor" strokeWidth="0.8" />
    <path d="M42 1l5 5-5 5-5-5z" fill="currentColor" />
    <circle cx="34.5" cy="6" r="1.2" fill="currentColor" />
    <circle cx="49.5" cy="6" r="1.2" fill="currentColor" />
  </svg>
);

/**
 * The biography as a book you page through — cover, title page,
 * dedication, contents, chapters and photo plates — laid out by
 * book-pages.ts for the current screen (one page on phones, a two-page
 * spread on wide screens) and re-laid out on resize. Arrow keys, swipes
 * and the buttons turn pages; the page number is kept in the URL hash so a
 * refresh or a shared link opens at the same place.
 */
export function BookReader({
  book,
  bundle,
  backHref,
  backLabel,
}: {
  book: BookData;
  /** For the PDF download (same content, print layout). */
  bundle?: LifeStoryBundle;
  backHref?: string;
  backLabel?: string;
}) {
  const reduceMotion = useReducedMotion();
  const [layout, setLayout] = useState<Layout | null>(null);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    const update = () => setLayout(measure());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const { pages, chapterStarts } = useMemo(() => {
    const l = layout ?? { width: 440, height: 640, fontSize: 17, padX: 44, padTop: 48, padBottom: 58, spread: false };
    const chars = charsPerPageFor(l.width - l.padX * 2, l.height - l.padTop - l.padBottom - 28, l.fontSize) * 0.92;
    return paginateBook({ chapters: book.chapters, charsPerPage: chars, hasDedication: Boolean(book.dedication.trim()), hasFilm: Boolean(book.film) });
  }, [book, layout]);

  // Which pages are on screen: the cover alone, then odd/even pairs in a spread.
  const spread = layout?.spread ?? false;
  const first = spread && index > 0 ? index - ((index - 1) % 2) : index;
  const visible = spread && first > 0 ? [first, first + 1].filter((i) => i < pages.length) : [first];
  const last = visible[visible.length - 1] ?? 0;

  const goTo = useCallback(
    (target: number) => {
      const clamped = Math.max(0, Math.min(pages.length - 1, target));
      setDirection(clamped >= index ? 1 : -1);
      setIndex(clamped);
      window.history.replaceState(null, "", clamped ? `#page-${clamped + 1}` : window.location.pathname + window.location.search);
    },
    [index, pages.length],
  );
  const next = useCallback(() => goTo(spread && first === 0 ? 1 : last + 1), [goTo, spread, first, last]);
  const prev = useCallback(() => goTo(spread ? first - (first === 1 ? 1 : 2) : first - 1), [goTo, spread, first]);

  // Open at the page in the link (#page-12).
  useEffect(() => {
    const match = /^#page-(\d+)$/.exec(window.location.hash);
    if (match) setIndex(Math.max(0, Math.min(pages.length - 1, Number(match[1]) - 1)));
    // Only on first load — later re-layouts keep the reader where they are.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, video")) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") next();
      else if (e.key === "ArrowLeft" || e.key === "PageUp") prev();
      else if (e.key === "Home") goTo(0);
      else if (e.key === "End") goTo(pages.length - 1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, goTo, pages.length]);

  const contentsIndex = pages.findIndex((p) => p.kind === "contents");
  const pageStyle = layout
    ? ({ width: layout.width, height: layout.height, fontSize: layout.fontSize } satisfies CSSProperties)
    : ({ width: 440, height: 640, fontSize: 17, visibility: "hidden" } satisfies CSSProperties);

  function renderPage(page: BookPage, i: number, side: "left" | "right" | "single"): ReactNode {
    const l = layout ?? { padX: 44, padTop: 48, padBottom: 58 };
    const padded = { paddingLeft: l.padX, paddingRight: l.padX, paddingTop: l.padTop, paddingBottom: l.padBottom };
    const sideClass = side === "left" ? s.left : side === "right" ? s.right : "";
    const folio = <div className={s.folio} style={{ bottom: l.padBottom * 0.42 }}>{i}</div>;
    const chapter = "chapter" in page ? book.chapters[page.chapter] : undefined;

    if (page.kind === "cover") {
      return (
        <div className={`${s.page} ${s.cover}`} style={pageStyle} key={i}>
          <div className={s.coverFrame}>
            <div>
              <p className={s.coverEyebrow}>{book.lifeSpan || "A Life Story"}</p>
              <h1 className={s.coverTitle}>{book.title}</h1>
              {book.subtitle ? <p className={s.coverSubtitle}>{book.subtitle}</p> : null}
            </div>
            {book.cover ? <img className={s.coverPhoto} src={book.cover.url} alt={book.cover.caption || book.title} /> : <Ornament />}
            <p className={s.coverByline}>{book.byline || "A Biography"}</p>
          </div>
        </div>
      );
    }

    let content: ReactNode;
    let runningHead: ReactNode = null;
    switch (page.kind) {
      case "title":
        content = (
          <div className={s.centerPage}>
            <p className={s.smallCaps}>A Biography</p>
            <h2 className={s.halfTitle} style={{ marginTop: 18 }}>{book.title}</h2>
            {book.subtitle ? <p style={{ marginTop: 12, fontStyle: "italic" }}>{book.subtitle}</p> : null}
            <Ornament />
            {book.lifeSpan ? <p className={s.smallCaps}>{book.lifeSpan}</p> : null}
            {book.byline ? <p style={{ marginTop: 28, fontStyle: "italic" }}>{book.byline}</p> : null}
          </div>
        );
        break;
      case "dedication":
        content = (
          <div className={s.centerPage}>
            <p className={s.dedication}>{book.dedication}</p>
          </div>
        );
        break;
      case "contents":
        content = (
          <div>
            <p className={s.smallCaps} style={{ textAlign: "center", paddingTop: "8%" }}>Contents</p>
            <Ornament />
            <ol className={s.contentsList}>
              {book.chapters.map((c, n) => (
                <li key={n}>
                  <button type="button" className={s.contentsItem} onClick={() => goTo(chapterStarts[n] ?? 0)}>
                    <span className={s.contentsNumber}>{n + 1}</span>
                    <span className={s.contentsTitle}>{c.title}</span>
                    <span className={s.contentsLeader} aria-hidden />
                    <span>{(chapterStarts[n] ?? 0)}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        );
        break;
      case "text":
        if (!page.opener) runningHead = side === "left" ? book.title : chapter?.title;
        content = (
          <div className={s.prose}>
            {page.opener && chapter ? (
              <div className={s.opener}>
                <p className={s.chapterLabel}>Chapter {chapterNumberWord(page.chapter)}</p>
                <h2 className={s.chapterTitle}>{chapter.title}</h2>
                {chapter.period ? <p className={s.chapterPeriod}>{chapter.period}</p> : null}
                <Ornament />
                {chapter.epigraph ? (
                  <blockquote className={s.epigraph}>
                    “{chapter.epigraph.replace(/^["“]|["”]$/g, "")}”
                    {chapter.epigraphSource ? <span className={s.epigraphSource}>— {chapter.epigraphSource}</span> : null}
                  </blockquote>
                ) : null}
              </div>
            ) : null}
            {page.paragraphs.map((p, n) => (
              <p key={n} className={p.opening ? s.opening : p.continued ? s.flush : undefined}>
                {p.text}
              </p>
            ))}
          </div>
        );
        break;
      case "plate":
        content = (
          <figure className={s.plate}>
            <img className={s.plateImage} src={page.photo.url} alt={page.photo.caption || `A photograph from ${chapter?.title ?? "the story"}`} loading="lazy" />
            {page.photo.caption || page.photo.yearLabel ? (
              <figcaption className={s.plateCaption}>
                {page.photo.caption}
                {page.photo.caption && page.photo.yearLabel ? ", " : ""}
                {page.photo.yearLabel}
              </figcaption>
            ) : null}
          </figure>
        );
        break;
      case "film":
        content = (
          <div className={s.centerPage}>
            <p className={s.smallCaps}>The Film</p>
            <Ornament />
            <video className={s.film} src={book.film?.url} controls preload="none" playsInline poster={book.cover?.url} />
          </div>
        );
        break;
      case "end":
        content = (
          <div className={s.centerPage}>
            <Ornament />
            <p style={{ fontStyle: "italic", maxWidth: "80%", lineHeight: 1.6 }}>
              This book was written from the memories of the people who love {book.subjectName}.
            </p>
            {book.byline ? <p className={s.smallCaps} style={{ marginTop: 18 }}>{book.byline}</p> : null}
            <button type="button" className={s.readButton} onClick={() => goTo(contentsIndex)}>
              <List size={16} aria-hidden /> Back to contents
            </button>
            {bundle ? (
              <div style={{ marginTop: 14 }}>
                <DownloadBookButton bundle={bundle} />
              </div>
            ) : null}
          </div>
        );
        break;
    }

    return (
      <div className={`${s.page} ${sideClass}`} style={pageStyle} key={i}>
        <div className={s.pageInner} style={padded}>
          <div className={s.runningHead} aria-hidden>
            {runningHead}
          </div>
          <div className={s.body}>{content}</div>
        </div>
        {page.kind === "text" && !page.opener ? folio : null}
      </div>
    );
  }

  const offset = reduceMotion ? 0 : 28 * direction;

  return (
    <div className={s.reader} lang="en">
      <div className={s.toolbar}>
        {backHref ? (
          <a href={backHref} className={s.toolButton}>
            <ArrowLeft size={15} aria-hidden /> {backLabel ?? "Back"}
          </a>
        ) : (
          <span />
        )}
        <span className={s.toolbarTitle}>{book.title}</span>
        <button type="button" className={s.toolButton} onClick={() => goTo(contentsIndex)}>
          <List size={15} aria-hidden /> Contents
        </button>
      </div>

      <div
        className={s.stage}
        onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
        onTouchEnd={(e) => {
          const start = touchX.current;
          const end = e.changedTouches[0]?.clientX;
          touchX.current = null;
          if (start === null || end === undefined || Math.abs(end - start) < 50) return;
          if (end < start) next();
          else prev();
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={visible.join("-")}
            className={s.spread}
            initial={{ opacity: 0, x: offset }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -offset }}
            transition={{ duration: reduceMotion ? 0 : 0.45, ease: [0.22, 0.61, 0.36, 1] }}
            aria-live="polite"
          >
            {visible.map((i, n) => renderPage(pages[i]!, i, visible.length === 2 ? (n === 0 ? "left" : "right") : "single"))}
          </motion.div>
        </AnimatePresence>
      </div>

      <nav className={s.nav} aria-label="Turn pages">
        <button type="button" className={s.navButton} onClick={prev} disabled={first === 0} aria-label="Previous page">
          <ChevronLeft size={20} aria-hidden />
        </button>
        <div className={s.progress} role="progressbar" aria-valuemin={1} aria-valuemax={pages.length} aria-valuenow={last + 1} aria-label="Reading progress">
          <div className={s.progressFill} style={{ width: `${((last + 1) / pages.length) * 100}%` }} />
        </div>
        <button type="button" className={s.navButton} onClick={next} disabled={last >= pages.length - 1} aria-label="Next page">
          <ChevronRight size={20} aria-hidden />
        </button>
      </nav>
    </div>
  );
}

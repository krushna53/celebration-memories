import { storyParagraphs } from "@/lib/life-story";

/**
 * Lays a biography out as the pages of a printed book — cover, title page,
 * dedication, contents, then each chapter (an opener with its number, title
 * and epigraph, running text pages, photo plates), and an end page.
 *
 * Pure and framework-free so the reader (features/life-story/book-reader.tsx)
 * can re-run it whenever the screen size changes: `charsPerPage` is how much
 * text fits on one full page at the current size. Paragraphs that don't fit
 * are split at a sentence (or word) boundary and carried over, marked
 * `continued` so the next page doesn't indent them.
 */

export interface BookChapterInput {
  title: string;
  period: string;
  epigraph: string;
  epigraphSource: string;
  body: string;
  photos: { url: string; caption: string; yearLabel: string }[];
}

export interface BookParagraph {
  text: string;
  /** The rest of a paragraph started on the previous page (no indent). */
  continued: boolean;
  /** The chapter's opening paragraph (drop cap, small-caps first line). */
  opening: boolean;
}

export type BookPage =
  | { kind: "cover" }
  | { kind: "title" }
  | { kind: "dedication" }
  | { kind: "contents" }
  | { kind: "text"; chapter: number; opener: boolean; paragraphs: BookParagraph[] }
  | { kind: "plate"; chapter: number; photo: BookChapterInput["photos"][number] }
  | { kind: "film" }
  | { kind: "end" };

const NUMBER_WORDS = [
  "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen", "Twenty",
];

/** "Chapter One" … "Chapter Twenty", then digits. */
export function chapterNumberWord(index: number): string {
  return NUMBER_WORDS[index] ?? String(index + 1);
}

/** Splits `text` so the head is at most `limit` chars, preferring a sentence end, then a word break. */
export function splitParagraph(text: string, limit: number): [string, string] {
  if (text.length <= limit) return [text, ""];
  const window = text.slice(0, limit);
  const sentence = Math.max(window.lastIndexOf(". "), window.lastIndexOf("? "), window.lastIndexOf("! "), window.lastIndexOf("” "));
  const cut = sentence > limit * 0.5 ? sentence + 1 : window.lastIndexOf(" ");
  if (cut <= 0) return [window, text.slice(limit).trimStart()];
  return [text.slice(0, cut).trimEnd(), text.slice(cut).trimStart()];
}

/** Text pages for one chapter; the first is the opener, which has room for only part of a page. */
function chapterTextPages(chapter: BookChapterInput, index: number, charsPerPage: number): Extract<BookPage, { kind: "text" }>[] {
  const pages: Extract<BookPage, { kind: "text" }>[] = [];
  const openerShare = chapter.epigraph ? 0.36 : 0.5;
  let current: BookParagraph[] = [];
  let room = Math.round(charsPerPage * openerShare);
  // Below this, a fragment isn't worth starting at the foot of a page.
  const minFragment = Math.max(120, Math.round(charsPerPage * 0.12));

  const flush = () => {
    pages.push({ kind: "text", chapter: index, opener: pages.length === 0, paragraphs: current });
    current = [];
    room = charsPerPage;
  };

  storyParagraphs(chapter.body).forEach((paragraph, p) => {
    let rest = paragraph;
    let continued = false;
    while (rest) {
      // Each paragraph break costs roughly half a line of space.
      const cost = rest.length + 30;
      if (cost <= room) {
        current.push({ text: rest, continued, opening: p === 0 && !continued });
        room -= cost;
        rest = "";
      } else if (room >= minFragment) {
        const [head, tail] = splitParagraph(rest, room - 30);
        current.push({ text: head, continued, opening: p === 0 && !continued });
        rest = tail;
        continued = true;
        flush();
      } else {
        flush();
      }
    }
  });
  if (current.length || pages.length === 0) flush();
  return pages;
}

export function paginateBook(params: {
  chapters: BookChapterInput[];
  charsPerPage: number;
  hasDedication: boolean;
  hasFilm: boolean;
}): { pages: BookPage[]; chapterStarts: number[] } {
  const charsPerPage = Math.max(400, Math.round(params.charsPerPage));
  const pages: BookPage[] = [{ kind: "cover" }, { kind: "title" }];
  if (params.hasDedication) pages.push({ kind: "dedication" });
  pages.push({ kind: "contents" });

  const chapterStarts: number[] = [];
  params.chapters.forEach((chapter, index) => {
    chapterStarts.push(pages.length);
    const text = chapterTextPages(chapter, index, charsPerPage);
    // Photo plates sit between the chapter's text pages, evenly spaced, never before the opener.
    const plates = chapter.photos;
    const gap = Math.max(1, Math.floor(text.length / (plates.length + 1)) || 1);
    let plate = 0;
    text.forEach((page, i) => {
      pages.push(page);
      if (plate < plates.length && (i + 1) % gap === 0 && i < text.length - 1) {
        pages.push({ kind: "plate", chapter: index, photo: plates[plate++]! });
      }
    });
    while (plate < plates.length) pages.push({ kind: "plate", chapter: index, photo: plates[plate++]! });
  });

  if (params.hasFilm) pages.push({ kind: "film" });
  pages.push({ kind: "end" });
  return { pages, chapterStarts };
}

/** How many characters fill one page of `width`×`height` CSS px at `fontSize` px (EB Garamond, 1.6 line height). */
export function charsPerPageFor(width: number, height: number, fontSize: number): number {
  const charsPerLine = width / (fontSize * 0.45);
  const lines = height / (fontSize * 1.6);
  return Math.floor(charsPerLine * lines * 0.9);
}

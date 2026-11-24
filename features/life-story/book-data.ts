import type { LifeStoryBundle, LifeStoryPhoto } from "@/types/life-story";
import type { BookChapterInput } from "@/features/life-story/book-pages";

/** Everything the book reader shows — plain data, so a Server Component can hand it to the client reader. */
export interface BookData {
  title: string;
  subtitle: string;
  lifeSpan: string;
  subjectName: string;
  /** "Shared by The Shah Family" etc. — printed on the cover and title page; may be "". */
  byline: string;
  dedication: string;
  cover: { url: string; caption: string } | null;
  film: { url: string } | null;
  chapters: BookChapterInput[];
}

export function toBookData(bundle: LifeStoryBundle, byline = ""): BookData {
  const { story, chapters, photos, film } = bundle;
  const cover = photos.find((p) => p.id === story.coverPhotoId) ?? photos[0] ?? null;
  const byChapter = new Map<string, LifeStoryPhoto[]>();
  for (const photo of photos) {
    if (!photo.chapterId || photo.id === cover?.id) continue;
    byChapter.set(photo.chapterId, [...(byChapter.get(photo.chapterId) ?? []), photo]);
  }
  return {
    title: story.title || story.subjectName,
    subtitle: story.subtitle,
    lifeSpan: story.lifeSpan,
    subjectName: story.subjectName,
    byline,
    dedication: story.dedication,
    cover: cover ? { url: cover.url, caption: cover.caption } : null,
    film: film ? { url: film.url } : null,
    chapters: chapters.map((c) => ({
      title: c.title,
      period: c.period,
      epigraph: c.epigraph,
      epigraphSource: c.epigraphSource,
      body: c.body,
      photos: (byChapter.get(c.id) ?? []).map((p) => ({ url: p.url, caption: p.caption, yearLabel: p.yearLabel })),
    })),
  };
}

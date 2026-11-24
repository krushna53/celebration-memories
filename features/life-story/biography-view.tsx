import { storyParagraphs } from "@/lib/life-story";
import type { LifeStoryBundle, LifeStoryPhoto } from "@/types/life-story";
import { DownloadBookButton } from "@/features/life-story/download-book-button";

/**
 * The biography as a long, quiet reading page — cover, film, then chapters
 * with their photos. Pure presentation (no data access), so it renders both
 * on the public /life-story/[token] page and as the admin preview.
 */
export function BiographyView({ bundle, showDownload = true }: { bundle: LifeStoryBundle; showDownload?: boolean }) {
  const { story, chapters, photos, film } = bundle;
  const cover = photos.find((p) => p.id === story.coverPhotoId) ?? photos[0] ?? null;
  const byChapter = new Map<string, LifeStoryPhoto[]>();
  for (const photo of photos) {
    if (!photo.chapterId || photo.id === cover?.id) continue;
    byChapter.set(photo.chapterId, [...(byChapter.get(photo.chapterId) ?? []), photo]);
  }
  const title = story.title || story.subjectName;

  return (
    <article className="bg-ivory-50 text-navy-950">
      <header className="relative isolate overflow-hidden bg-navy-950 text-ivory-50">
        {cover ? <img src={cover.url} alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full object-cover opacity-35 blur-sm" /> : null}
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-10 px-4 py-16 sm:px-6 md:flex-row md:py-24">
          {cover ? (
            <img src={cover.url} alt={cover.caption || title} className="w-56 shrink-0 rounded-sm border-8 border-ivory-50 object-cover shadow-2xl sm:w-72" />
          ) : null}
          <div className="text-center md:text-left">
            <p className="text-xs uppercase tracking-[0.35em] text-gold-200">A life story</p>
            <h1 className="mt-4 font-display text-4xl leading-tight sm:text-6xl">{title}</h1>
            {story.subtitle ? <p className="mt-4 font-display text-xl italic text-ivory-100/85">{story.subtitle}</p> : null}
            {story.lifeSpan ? <p className="mt-5 text-sm tracking-[0.3em] text-gold-200">{story.lifeSpan}</p> : null}
            {showDownload && chapters.length ? (
              <div className="mt-8">
                <DownloadBookButton bundle={bundle} variant="light" />
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {film ? (
        <section aria-label="Film" className="mx-auto max-w-4xl px-4 pt-12 sm:px-6">
          <video src={film.url} controls preload="metadata" poster={cover?.url} className="aspect-video w-full rounded-lg bg-black shadow-xl" />
        </section>
      ) : null}

      {chapters.length > 1 ? (
        <nav aria-label="Chapters" className="mx-auto max-w-2xl px-4 pt-12 sm:px-6">
          <ol className="space-y-1 border-l border-gold-500/40 pl-5 text-sm">
            {chapters.map((c, i) => (
              <li key={c.id}>
                <a href={`#chapter-${i + 1}`} className="text-navy-800 hover:text-gold-600">
                  <span className="mr-2 text-navy-700/50">{i + 1}.</span>
                  {c.title}
                  {c.period ? <span className="ml-2 text-navy-700/50">{c.period}</span> : null}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      <div className="mx-auto max-w-2xl px-4 pb-20 sm:px-6">
        {chapters.map((chapter, i) => {
          const chapterPhotos = byChapter.get(chapter.id) ?? [];
          const paragraphs = storyParagraphs(chapter.body);
          return (
            <section key={chapter.id} id={`chapter-${i + 1}`} className="scroll-mt-8 pt-16">
              <p className="text-xs uppercase tracking-[0.3em] text-gold-600">Chapter {i + 1}</p>
              <h2 className="mt-2 font-display text-3xl sm:text-4xl">{chapter.title}</h2>
              {chapter.period ? <p className="mt-1 text-sm text-navy-700/60">{chapter.period}</p> : null}
              <div className="mt-6 space-y-5 font-serif text-lg leading-relaxed text-navy-900">
                {paragraphs.map((p, n) => (
                  <p key={n} className={n === 0 ? "first-letter:float-left first-letter:mr-2 first-letter:font-display first-letter:text-6xl first-letter:leading-none first-letter:text-gold-600" : undefined}>
                    {p}
                  </p>
                ))}
              </div>
              {chapterPhotos.length ? (
                <div className={chapterPhotos.length === 1 ? "mt-8" : "mt-8 grid grid-cols-2 gap-4"}>
                  {chapterPhotos.map((photo) => (
                    <figure key={photo.id}>
                      <img src={photo.url} alt={photo.caption || chapter.title} loading="lazy" className="w-full rounded-sm bg-ivory-100 object-cover shadow-md" />
                      {photo.caption || photo.yearLabel ? (
                        <figcaption className="mt-2 text-center text-sm italic text-navy-700/70">
                          {photo.caption}
                          {photo.caption && photo.yearLabel ? " · " : ""}
                          {photo.yearLabel}
                        </figcaption>
                      ) : null}
                    </figure>
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </article>
  );
}

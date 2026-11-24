import { BookOpen, CalendarRange } from "lucide-react";

import { getEventBook } from "@/services/life-story";
import type { EventRecord } from "@/types/event";

/**
 * The Biography page's first fold: the book itself — a gilt-framed
 * hardback cover with the family's cover photo — beside the title and a
 * "Read the Book" button into /events/<slug>/book. Until the book has been
 * written it says so instead of linking to an empty reader. A finished
 * (optional) film plays just below.
 */
export async function BestsellerHero({ event, hasTimeline }: { event: EventRecord; hasTimeline: boolean }) {
  const bundle = await getEventBook(event.id);
  const story = bundle?.story;
  const cover = bundle ? bundle.photos.find((p) => p.id === story?.coverPhotoId) ?? bundle.photos[0] ?? null : null;
  const title = story?.title || event.honoreeName;
  const subtitle = story?.subtitle || event.eventTitle || "";
  const lifeSpan = story?.lifeSpan ?? "";
  const bookHref = `/events/${encodeURIComponent(event.slug)}/book`;

  return (
    <>
      <section id="hero" className="bs-hero relative isolate overflow-hidden bg-navy-950 text-ivory-100">
        {cover ? <img src={cover.url} alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full scale-110 object-cover opacity-20 blur-md" /> : null}
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-navy-950/60 via-navy-950/80 to-navy-950" aria-hidden />
        <div className="mx-auto flex min-h-[92vh] max-w-6xl flex-col items-center justify-center gap-12 px-4 pb-16 pt-28 sm:px-6 md:flex-row md:gap-16">
          <div className="bs-book shrink-0" aria-hidden={!cover}>
            <div className="bs-book-cover">
              <div className="bs-book-frame">
                <p className="text-[10px] uppercase tracking-[0.4em] text-gold-300">{lifeSpan || "A Biography"}</p>
                <p className="mt-2 font-display text-2xl uppercase leading-none tracking-wide text-gold-100">{title}</p>
                {cover ? <img src={cover.url} alt={cover.caption || title} className="bs-book-photo" /> : <span className="bs-book-photo bs-book-photo-empty" />}
                <p className="text-[9px] uppercase tracking-[0.32em] text-gold-300">{event.hostedBy || "A family biography"}</p>
              </div>
            </div>
          </div>

          <div className="max-w-xl text-center md:text-left">
            <p className="text-xs uppercase tracking-[0.4em] text-gold-300">A Biography</p>
            <h1 className="mt-4 font-display text-5xl font-medium leading-[1.02] text-ivory-50 sm:text-6xl lg:text-7xl">{title}</h1>
            {subtitle ? <p className="mt-5 text-xl italic text-gold-100/90">{subtitle}</p> : null}
            {lifeSpan ? <p className="mt-3 font-display text-lg tracking-[0.2em] text-gold-300">{lifeSpan}</p> : null}
            {event.hostedBy ? <p className="mt-6 text-sm uppercase tracking-[0.25em] text-ivory-100/60">Shared by {event.hostedBy}</p> : null}

            {bundle ? (
              <>
                <p className="mt-6 text-base text-ivory-100/70">
                  {bundle.chapters.length} chapters · {bundle.photos.length} photographs
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-3 md:justify-start">
                  <a
                    href={bookHref}
                    className="inline-flex items-center gap-2 rounded-full bg-gold-500 px-7 py-3.5 font-display text-lg tracking-wide text-navy-950 shadow-lg shadow-black/30 transition-luxury duration-500 hover:bg-gold-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-300"
                  >
                    <BookOpen size={20} aria-hidden /> Read the Book
                  </a>
                  {hasTimeline ? (
                    <a
                      href="#timeline"
                      className="inline-flex items-center gap-2 rounded-full border border-gold-300/50 px-6 py-3.5 font-display text-lg tracking-wide text-ivory-50 transition-luxury duration-500 hover:bg-gold-300/10"
                    >
                      <CalendarRange size={19} aria-hidden /> The Life Timeline
                    </a>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="mt-8 italic text-ivory-100/70">The book is still being written — please come back soon.</p>
            )}
          </div>
        </div>
      </section>

      {bundle?.film ? (
        <section aria-label="The film" className="bg-navy-950 px-4 pb-20 sm:px-6">
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-xs uppercase tracking-[0.4em] text-gold-300">The Film</p>
            <video src={bundle.film.url} controls preload="none" playsInline poster={cover?.url} className="mt-6 w-full rounded-sm shadow-2xl shadow-black/50" />
          </div>
        </section>
      ) : null}
    </>
  );
}

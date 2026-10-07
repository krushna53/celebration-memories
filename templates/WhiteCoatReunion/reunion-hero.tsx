"use client";

import type { CSSProperties } from "react";
import { CalendarDays, Clock, MapPin } from "lucide-react";

import type { EventDisplayData } from "@/lib/event-display";
import type { HeroRelive } from "@/features/hero/hero-section";
import type { GalleryPhotoRecord } from "@/types/content";
import { isVideoMedia } from "@/lib/curated-media";
import { Button } from "@/components/ui/button";
import { useCountdown } from "@/hooks/use-countdown";
import { BatchMedallion, ReunionBackdrop, StethoscopeAccent } from "@/templates/WhiteCoatReunion/reunion-decor";

interface ReunionHeroProps {
  data: EventDisplayData;
  galleryPhotos: GalleryPhotoRecord[];
  relive: HeroRelive | null;
}

/** Staggered entrance step — the actual fade/rise is CSS (white-coat-reunion.css), so content is visible even without JS. */
function rise(step: number): CSSProperties {
  return { "--wcr-delay": `${step * 70}ms` } as CSSProperties;
}

const UNITS = [
  { key: "days", label: "Days" },
  { key: "hours", label: "Hours" },
  { key: "minutes", label: "Minutes" },
  { key: "seconds", label: "Seconds" },
] as const;

/**
 * The page's single countdown, sitting with the event facts. Deliberately
 * not aria-live (screen readers would announce every second); the date is
 * always shown as plain text above it, and once the start time passes it
 * switches to a status line instead of counting into negatives.
 */
function ReunionCountdown({ isoStart }: { isoStart: string }) {
  const remaining = useCountdown(isoStart);

  if (remaining?.isPast) {
    return (
      <p className="wcr-countdown-status rounded-2xl px-5 py-4 text-base font-medium text-navy-950">
        The reunion is underway — welcome back, everyone!
      </p>
    );
  }

  return (
    <div role="timer" aria-label="Time until the reunion begins">
      <dl className="grid max-w-md grid-cols-4 gap-2 sm:gap-3">
        {UNITS.map((unit) => (
          <div key={unit.key} className="wcr-countdown-cell flex flex-col-reverse items-center rounded-xl px-1 py-3">
            <dt className="mt-1 text-[0.75rem] font-medium uppercase tracking-[0.12em] text-navy-700 sm:text-[0.8125rem]">
              {unit.label}
            </dt>
            <dd className="font-display text-2xl font-semibold tabular-nums text-navy-950 sm:text-3xl">
              {remaining ? String(remaining[unit.key]).padStart(2, "0") : "--"}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * White Coat Reunion hero: a wide, light opening section — event facts,
 * the one countdown and both calls to action on the left; the batch's own
 * featured photograph (first gallery photo) with a decorative medallion on
 * the right. Falls back to a larger medallion when the gallery is empty
 * rather than stretching a placeholder image.
 */
export function ReunionHero({ data, galleryPhotos, relive }: ReunionHeroProps) {
  const featured = [...galleryPhotos]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .find((photo) => !isVideoMedia(photo.url));
  const medallionLabel = data.occasion?.trim() || "Reunion";
  const venue = [data.venueName, data.venueAddress].filter(Boolean).join(", ");

  return (
    <section id="hero" className="wcr-hero relative overflow-hidden bg-ivory-50 pt-24 pb-14 sm:pt-28 lg:pb-20">
      <ReunionBackdrop />

      <div className="relative mx-auto grid w-full max-w-[1120px] items-center gap-10 px-5 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
        <div>
          <p className="wcr-rise text-[0.8125rem] font-semibold uppercase tracking-[0.22em] text-gold-500" style={rise(0)}>
            {relive ? "Thank you for celebrating with us" : medallionLabel}
          </p>

          <h1 className="wcr-rise wcr-title mt-4 font-display text-navy-950" style={rise(1)}>
            {data.honoreeName}
          </h1>

          <p className="wcr-rise mt-3 font-display text-xl italic text-navy-800 sm:text-2xl" style={rise(2)}>
            {data.eventTitle}
          </p>

          <div className="wcr-rise wcr-rule mt-6 w-28" style={rise(2)} aria-hidden="true" />

          <p className="wcr-rise mt-5 text-base text-navy-700 sm:text-lg" style={rise(3)}>
            Hosted by <span className="font-medium text-navy-950">{data.hostedBy}</span>
          </p>

          <ul className="wcr-rise mt-6 grid gap-3 text-base text-navy-950 sm:text-[1.0625rem]" style={rise(3)}>
            <li className="flex items-start gap-3">
              <CalendarDays aria-hidden="true" size={20} className="mt-0.5 shrink-0 text-gold-500" />
              <span>
                <span className="sr-only">Date: </span>
                <span className="font-semibold">{data.dayOfWeek}, {data.date}</span>
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Clock aria-hidden="true" size={20} className="mt-0.5 shrink-0 text-gold-500" />
              <span>
                <span className="sr-only">Time: </span>
                {data.timeRange}
              </span>
            </li>
            {venue ? (
              <li className="flex items-start gap-3">
                <MapPin aria-hidden="true" size={20} className="mt-0.5 shrink-0 text-gold-500" />
                <span>
                  <span className="sr-only">Venue: </span>
                  {data.venueName ? <span className="font-semibold">{data.venueName}</span> : null}
                  {data.venueName && data.venueAddress ? <br /> : null}
                  {data.venueAddress ? <span className="text-navy-700">{data.venueAddress}</span> : null}
                </span>
              </li>
            ) : null}
          </ul>

          {relive ? (
            <p className="wcr-rise mt-6 max-w-md text-base leading-relaxed text-navy-700" style={rise(4)}>
              Relive the day — add the photos and videos you took, and see everyone else&rsquo;s.
            </p>
          ) : (
            <div className="wcr-rise mt-7" style={rise(4)}>
              <ReunionCountdown isoStart={data.isoStart} />
            </div>
          )}

          <div className="wcr-rise mt-8 flex flex-col gap-3 sm:flex-row" style={rise(5)}>
            {relive ? (
              <>
                <Button asChild size="lg" className="wcr-btn">
                  <a href={relive.shareHref}>Add your photos &amp; videos</a>
                </Button>
                <Button asChild variant="outline" size="lg" className="wcr-btn">
                  <a href="#memories">See the memories</a>
                </Button>
              </>
            ) : (
              <>
                <Button asChild size="lg" className="wcr-btn">
                  <a href="#rsvp">RSVP Now</a>
                </Button>
                <Button asChild variant="outline" size="lg" className="wcr-btn">
                  <a href="#details">View Event Details</a>
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="wcr-rise relative isolate mx-auto w-full max-w-md lg:max-w-none" style={rise(2)}>
          <StethoscopeAccent className="absolute -top-8 -right-10 -z-10 h-64 w-48 opacity-45 sm:-right-16 sm:h-80 sm:w-60" />
          {featured ? (
            <figure className="wcr-photo relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- signed /media URL, sized by CSS */}
              <img
                src={featured.url}
                alt={featured.caption?.trim() || `${data.honoreeName} — batch photograph`}
                className="aspect-[4/5] w-full rounded-[10px] object-cover object-[50%_30%]"
                fetchPriority="high"
              />
              {featured.caption?.trim() ? (
                <figcaption className="mt-3 text-center text-sm text-navy-700">{featured.caption.trim()}</figcaption>
              ) : null}
              <BatchMedallion
                label={medallionLabel}
                className="absolute -bottom-8 -left-6 h-28 w-28 drop-shadow-md sm:-left-10 sm:h-32 sm:w-32"
              />
            </figure>
          ) : (
            <BatchMedallion label={medallionLabel} className="mx-auto h-64 w-64 drop-shadow-sm sm:h-80 sm:w-80" />
          )}
        </div>
      </div>
    </section>
  );
}

"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CalendarDays, Clock, Laptop, MapPin, MessageCircle } from "lucide-react";

import type { EventDisplayData } from "@/lib/event-display";
import type { HeroExtras, HeroRelive } from "@/features/hero/hero-section";
import { getSegmentCopy } from "@/lib/event-segment";
import { useCountdown } from "@/hooks/use-countdown";

/** The card's own illustration colours, used only for soft background shapes. */
const CARD = { teal: "#2e7d6b", coral: "#e2674a", sky: "#4fa3b5", mustard: "#d4a03a", navy: "#12294a" };

const ONLINE = /\b(online|virtual|zoom|google meet|teams|webinar|live ?stream)\b/i;

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * HumanOS hero — replaces the shared hero for this template only
 * (templates/HumanOs/index.tsx → EventSections renderHero). Built from the
 * card's language: navy type on cream, teal actions, the "O" of HumanOS
 * (rings with a mustard dot) and the card's own illustration floating on
 * the right. Every animation stops for visitors who prefer reduced motion.
 */
export function HumanOsHero({
  data,
  relive,
  extras,
}: {
  data: EventDisplayData;
  relive: HeroRelive | null;
  extras: HeroExtras;
}) {
  const reduce = useReducedMotion() ?? false;
  const guestCopy = getSegmentCopy(data.category).guest;
  const remaining = useCountdown(data.isoStart);
  const online = ONLINE.test(data.venueName ?? "");
  const words = data.honoreeName.split(/\s+/).filter(Boolean);

  const rise = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 24 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.8, delay, ease: EASE },
        };

  const chips = [
    { icon: CalendarDays, text: `${data.dayOfWeek}, ${data.date}` },
    { icon: Clock, text: data.timeRange },
    ...(data.venueName ? [{ icon: online ? Laptop : MapPin, text: data.venueName }] : []),
  ];

  const units = [
    { label: "Days", value: remaining?.days },
    { label: "Hours", value: remaining?.hours },
    { label: "Min", value: remaining?.minutes },
    { label: "Sec", value: remaining?.seconds },
  ];

  return (
    <section id="hero" className="relative overflow-hidden bg-ivory-50 pb-20 pt-28 sm:pb-24 sm:pt-32 lg:min-h-[100svh] lg:pt-36">
      {/* Background: a faint dot grid and slowly drifting colour shapes from the card's illustration. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{ backgroundImage: `radial-gradient(${CARD.navy}14 1px, transparent 1px)`, backgroundSize: "26px 26px" }}
        />
        <div className={`hos-blob hos-blob-a ${reduce ? "" : "hos-drift-a"}`} style={{ background: CARD.teal }} />
        <div className={`hos-blob hos-blob-b ${reduce ? "" : "hos-drift-b"}`} style={{ background: CARD.coral }} />
        <div className={`hos-blob hos-blob-c ${reduce ? "" : "hos-drift-c"}`} style={{ background: CARD.sky }} />
      </div>

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
        {/* Text column */}
        <div className="text-center lg:text-left">
          <motion.p
            {...rise(0)}
            className="inline-flex items-center gap-2 rounded-full border border-navy-950/10 bg-white/70 px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.25em] text-navy-700 backdrop-blur sm:text-xs"
          >
            <span className="h-2 w-2 rounded-full" style={{ background: CARD.mustard }} aria-hidden="true" />
            {relive ? guestCopy.thankYou : data.occasion || "You're invited"}
          </motion.p>

          <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.05] tracking-tight text-navy-950 sm:text-6xl lg:text-7xl">
            {words.map((word, i) => (
              <motion.span
                key={`${word}-${i}`}
                className="mr-[0.25em] inline-block last:mr-0"
                {...(reduce
                  ? {}
                  : {
                      initial: { opacity: 0, y: 40, rotate: 2 },
                      animate: { opacity: 1, y: 0, rotate: 0 },
                      transition: { duration: 0.9, delay: 0.15 + i * 0.12, ease: EASE },
                    })}
              >
                {word}
              </motion.span>
            ))}
          </h1>

          {data.eventTitle ? (
            <motion.div {...rise(0.45)} className="mt-5">
              <p className="font-display text-2xl font-medium text-gold-600 sm:text-3xl">{data.eventTitle}</p>
              <motion.span
                aria-hidden="true"
                className="mx-auto mt-4 block h-1 rounded-full lg:mx-0"
                style={{ background: CARD.mustard, width: reduce ? 72 : undefined }}
                {...(reduce ? {} : { initial: { width: 0 }, animate: { width: 72 }, transition: { duration: 0.8, delay: 0.9, ease: EASE } })}
              />
            </motion.div>
          ) : null}

          {data.hostedBy ? (
            <motion.p {...rise(0.55)} className="mt-5 text-sm text-navy-700/80 sm:text-base">
              Hosted by <span className="font-semibold text-navy-950">{data.hostedBy}</span>
            </motion.p>
          ) : null}

          <motion.ul {...rise(0.65)} className="mt-7 flex flex-wrap justify-center gap-2.5 lg:justify-start">
            {chips.map(({ icon: Icon, text }) => (
              <li
                key={text}
                className="inline-flex items-center gap-2 rounded-full border border-navy-950/10 bg-white/80 px-4 py-2 text-sm font-medium text-navy-950 shadow-sm backdrop-blur"
              >
                <Icon size={16} className="text-gold-600" aria-hidden="true" />
                {text}
              </li>
            ))}
          </motion.ul>

          {relive ? (
            <motion.p {...rise(0.75)} className="mt-8 max-w-md text-base leading-relaxed text-navy-700/85 lg:max-w-lg">
              Relive the day — add the photos and videos you took, and see everyone else&rsquo;s.
            </motion.p>
          ) : (
            <motion.div {...rise(0.75)} className="mt-8 flex justify-center gap-2.5 lg:justify-start" role="timer" aria-label={guestCopy.countdownLabel}>
              {units.map((unit) => (
                <div
                  key={unit.label}
                  className="flex w-[4.6rem] flex-col items-center rounded-2xl border border-navy-950/10 bg-white/85 py-3 shadow-sm backdrop-blur sm:w-20"
                >
                  <span className="font-display text-2xl font-semibold tabular-nums text-navy-950 sm:text-3xl">
                    {unit.value === undefined ? "--" : String(unit.value).padStart(2, "0")}
                  </span>
                  <span className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-navy-700/60 sm:text-[11px]">{unit.label}</span>
                </div>
              ))}
            </motion.div>
          )}

          <motion.div {...rise(0.85)} className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center lg:justify-start">
            {relive ? (
              <>
                <a href={relive.shareHref} className="hos-btn hos-btn-primary">
                  Add your photos &amp; videos
                </a>
                <a href="#memories" className="hos-btn hos-btn-ghost">
                  {guestCopy.seeWall}
                </a>
              </>
            ) : (
              <>
                {extras.whatsapp ? (
                  <a href={extras.whatsapp.href} target="_blank" rel="noopener noreferrer" className="hos-btn hos-btn-whatsapp">
                    <MessageCircle size={18} aria-hidden="true" />
                    {extras.whatsapp.label}
                  </a>
                ) : null}
                <a href="#rsvp" className="hos-btn hos-btn-primary">
                  RSVP Now
                </a>
                <a href="#details" className="hos-btn hos-btn-ghost">
                  View Details
                </a>
              </>
            )}
          </motion.div>
        </div>

        {/* Visual column: the "O" rings with an orbiting mustard dot, and the card's illustration floating in front. */}
        <motion.div
          className="relative mx-auto aspect-square w-full max-w-[30rem]"
          {...(reduce
            ? {}
            : { initial: { opacity: 0, scale: 0.92 }, animate: { opacity: 1, scale: 1 }, transition: { duration: 1.1, delay: 0.3, ease: EASE } })}
        >
          <div aria-hidden="true" className={`absolute inset-0 ${reduce ? "" : "hos-spin"}`}>
            <svg viewBox="0 0 400 400" className="h-full w-full">
              <circle cx="200" cy="200" r="190" fill="none" stroke={CARD.navy} strokeOpacity="0.08" strokeWidth="2" />
              <circle cx="200" cy="200" r="150" fill="none" stroke={CARD.teal} strokeOpacity="0.18" strokeWidth="2" strokeDasharray="4 10" />
              <circle cx="200" cy="200" r="110" fill="none" stroke={CARD.navy} strokeOpacity="0.07" strokeWidth="2" />
              <circle cx="200" cy="10" r="9" fill={CARD.mustard} />
              <circle cx="350" cy="200" r="5" fill={CARD.coral} fillOpacity="0.8" />
              <circle cx="58" cy="290" r="6" fill={CARD.sky} fillOpacity="0.8" />
            </svg>
          </div>

          <div className="absolute inset-[11%] flex items-center justify-center">
            <div className={`relative w-full ${reduce ? "" : "hos-float"}`}>
              <div aria-hidden="true" className="absolute -inset-4 rounded-[2.5rem] bg-white/50 blur-xl" />
              {extras.artworkUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={extras.artworkUrl}
                  alt={`Illustration for ${data.honoreeName}`}
                  className="relative mx-auto w-full rounded-[2rem] border border-white/80 bg-white/70 object-contain p-3 shadow-[0_30px_60px_-30px_rgba(18,41,74,0.45)]"
                />
              ) : (
                <div className="relative mx-auto flex aspect-square w-3/4 items-center justify-center rounded-full border-[14px] border-navy-950/90 shadow-[0_30px_60px_-30px_rgba(18,41,74,0.45)]">
                  <span className="h-1/4 w-1/4 rounded-full" style={{ background: CARD.mustard }} />
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Scroll cue */}
      {!reduce ? (
        <a
          href="#details"
          aria-label="Scroll to event details"
          className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 lg:block"
        >
          <span className="flex h-10 w-6 items-start justify-center rounded-full border-2 border-navy-950/25 p-1.5">
            <span className="hos-scroll h-2 w-1 rounded-full bg-navy-950/50" />
          </span>
        </a>
      ) : null}
    </section>
  );
}

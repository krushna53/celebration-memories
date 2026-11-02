import type { CSSProperties } from "react";

import type { EventDisplayData } from "@/lib/event-display";
import type { HeroRelive } from "@/features/hero/hero-section";
import { Button } from "@/components/ui/button";

interface FestiveLightsHeroProps {
  data: EventDisplayData;
  relive: HeroRelive | null;
  /** False when the host hid Event Details — the date and "View Details" go too. */
  showDetails: boolean;
}

/** Fixed positions so the server and client render the same sky (no Math.random in render). */
const LANTERNS = [
  { left: "8%", delay: 0, duration: 19, scale: 0.8 },
  { left: "22%", delay: 6, duration: 23, scale: 1 },
  { left: "41%", delay: 11, duration: 21, scale: 0.65 },
  { left: "63%", delay: 3, duration: 24, scale: 0.9 },
  { left: "79%", delay: 9, duration: 20, scale: 0.75 },
  { left: "92%", delay: 14, duration: 22, scale: 0.6 },
];

const SPARKLES = [
  [6, 14], [15, 32], [27, 9], [34, 46], [48, 18], [57, 38], [66, 8], [74, 28], [86, 16], [94, 40], [11, 58], [89, 62],
];

const BURSTS = [
  { left: "18%", top: "16%", delay: 1.5, hue: "var(--color-gold-300)" },
  { left: "80%", top: "12%", delay: 4.5, hue: "#ff8fa3" },
  { left: "62%", top: "26%", delay: 7.5, hue: "var(--color-gold-200)" },
];

const DIYAS = 7;
const BULBS = 15;

function vars(values: Record<string, string | number>): CSSProperties {
  return values as CSSProperties;
}

function Diya({ index }: { index: number }) {
  return (
    <div className="fl-diya" style={vars({ "--fl-flicker": `${1.6 + (index % 3) * 0.35}s`, "--fl-flicker-delay": `${index * 0.23}s` })}>
      <span className="fl-flame" />
      <svg viewBox="0 0 64 28" className="fl-diya-bowl" aria-hidden="true">
        <path d="M2 6 Q32 2 62 6 Q58 26 32 26 Q6 26 2 6 Z" style={{ fill: "var(--color-gold-600)" }} />
        <path d="M2 6 Q32 2 62 6 Q32 11 2 6 Z" style={{ fill: "var(--color-gold-400)" }} />
        <path d="M14 15 Q32 22 50 15" style={{ stroke: "var(--color-gold-200)" }} strokeWidth="1.5" fill="none" opacity="0.7" />
      </svg>
    </div>
  );
}

/** A small rangoli-style medallion used as the divider under the title. */
function RangoliDivider() {
  return (
    <svg viewBox="0 0 120 24" className="mx-auto mt-6 h-6 w-32" aria-hidden="true">
      <line x1="0" y1="12" x2="44" y2="12" style={{ stroke: "var(--color-gold-400)" }} strokeWidth="1" />
      <line x1="76" y1="12" x2="120" y2="12" style={{ stroke: "var(--color-gold-400)" }} strokeWidth="1" />
      <g transform="translate(60 12)">
        <g className="fl-rangoli">
        {Array.from({ length: 8 }, (_, i) => (
          <ellipse key={i} rx="3" ry="9" style={{ fill: "var(--color-gold-400)" }} opacity="0.85" transform={`rotate(${i * 45})`} />
        ))}
        <circle r="3.5" fill="#e0457b" />
        </g>
      </g>
    </svg>
  );
}

/**
 * Festival-of-lights hero: a string of twinkling lights across the top,
 * rising sky lanterns, sparkles and slow firework blooms in a plum night
 * sky, and a row of flickering diyas along the bottom. Purely decorative
 * layers are aria-hidden; the text sits in the same glass card as the
 * other templates. Animations live in festive-lights.css.
 */
export function FestiveLightsHero({ data, relive, showDetails }: FestiveLightsHeroProps) {
  const subtitle = data.eventTitle.trim();
  const showHost = data.hostedBy.trim() && data.hostedBy.trim().toLowerCase() !== subtitle.toLowerCase();

  return (
    <section id="hero" className="fl-hero surface-feature relative flex min-h-[100svh] items-center justify-center overflow-hidden">
      <div className="fl-sky" aria-hidden="true">
        <div className="fl-string">
          {Array.from({ length: BULBS }, (_, i) => (
            <span key={i} className="fl-bulb" style={vars({ "--fl-bulb-delay": `${(i % 5) * 0.4}s` })} />
          ))}
        </div>
        {SPARKLES.map(([left, top], i) => (
          <span key={i} className="fl-sparkle" style={vars({ left: `${left}%`, top: `${top}%`, "--fl-sparkle-delay": `${(i * 0.7) % 4}s` })} />
        ))}
        {BURSTS.map((b, i) => (
          <span key={i} className="fl-burst" style={vars({ left: b.left, top: b.top, "--fl-burst-delay": `${b.delay}s`, "--fl-burst-color": b.hue })} />
        ))}
        {LANTERNS.map((l, i) => (
          <span
            key={i}
            className="fl-lantern"
            style={vars({ left: l.left, "--fl-lantern-delay": `${l.delay}s`, "--fl-lantern-duration": `${l.duration}s`, "--fl-lantern-scale": l.scale })}
          />
        ))}
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-col items-center px-4 pb-40 pt-28 text-center sm:px-6 sm:pb-48 sm:pt-32">
        <div className="fl-rise glass-card w-full rounded-3xl px-5 py-9 sm:px-10 sm:py-14">
          <p className="text-xs uppercase tracking-[0.35em] text-gold-300/90">
            {relive ? "Thank you for celebrating with us" : data.occasion || "You're invited"}
          </p>
          <h1 className="fl-title mt-4 text-4xl text-ivory-50 sm:text-5xl md:text-6xl">{data.honoreeName}</h1>
          {subtitle ? <p className="mt-3 font-display text-xl italic text-gold-200 sm:text-2xl">{subtitle}</p> : null}
          {showHost ? <p className="mt-2 text-sm text-ivory-100/80">Hosted by {data.hostedBy}</p> : null}
          <RangoliDivider />

          {showDetails && !relive ? (
            <p className="mt-6">
              <span className="block font-display text-2xl font-semibold leading-snug text-ivory-50 sm:text-3xl">
                {data.dayOfWeek}, <br className="sm:hidden" />
                <span className="whitespace-nowrap">{data.date}</span>
              </span>
              <span className="mt-1.5 block text-lg font-medium tracking-wide text-ivory-100/90">{data.timeRange}</span>
            </p>
          ) : null}

          <div className="mt-9 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
            {relive ? (
              <Button asChild size="lg" className="w-full sm:w-auto">
                <a href={relive.shareHref}>Add your photos &amp; videos</a>
              </Button>
            ) : (
              <>
                <Button asChild size="lg" className="w-full sm:w-auto">
                  <a href="#rsvp">RSVP Now</a>
                </Button>
                {showDetails ? (
                  <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                    <a href="#details">View Details</a>
                  </Button>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="fl-diyas" aria-hidden="true">
        {Array.from({ length: DIYAS }, (_, i) => (
          <Diya key={i} index={i} />
        ))}
      </div>
    </section>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import {
  Expand,
  Heart,
  Minimize,
  Pause,
  Play,
  Quote,
  Sparkles,
} from "lucide-react";

import { formatEventDate } from "@/lib/format";
import type { DisplaySlide } from "@/types/display";

interface BigScreenSlideshowProps {
  slides: DisplaySlide[];
}

/** How long a non-media slide stays up before auto-advancing. */
const DURATIONS_MS: Record<string, number> = {
  title: 6000,
  "gallery-photo": 7000,
  timeline: 9000,
  "memory-photo": 7000,
};

/** Safety ceiling for video/audio slides in case `onEnded` never fires (bad file, stalled load, etc.) — advances anyway so the loop can't get stuck. */
const MEDIA_FALLBACK_MS: Record<string, number> = {
  "memory-video": 60_000,
  "memory-audio": 45_000,
  "highlight-reel": 300_000,
};

function noteDurationMs(message: string): number {
  return Math.min(Math.max(6000, message.length * 60), 16_000);
}

/**
 * Chrome-free, full-viewport slideshow for the "Big Screen Display" —
 * meant to be opened on a TV/projector at the venue (see
 * app/events/[slug]/display). No header, footer, or nav; just slides.
 *
 * Starts gated behind a "Tap to Begin" screen: browsers block
 * autoplaying media with sound until a real user gesture happens, and
 * this deck mixes in guest-submitted videos/audio, so one tap up front
 * (which also best-effort requests fullscreen) is simpler and more
 * reliable than trying to route around autoplay policies per slide.
 */
export function BigScreenSlideshow({ slides }: BigScreenSlideshowProps) {
  const [index, setIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const slide = slides[index];

  const goNext = useCallback(() => {
    setIndex((i) => (slides.length === 0 ? 0 : (i + 1) % slides.length));
  }, [slides.length]);

  const goPrev = useCallback(() => {
    setIndex((i) => (slides.length === 0 ? 0 : (i - 1 + slides.length) % slides.length));
  }, [slides.length]);

  // Auto-advance timer for non-media (or media-fallback) slides.
  useEffect(() => {
    if (!started || paused || !slide) return;

    let ms = DURATIONS_MS[slide.kind];
    if (slide.kind === "memory-note") ms = noteDurationMs(slide.message);
    if (slide.kind === "memory-video" || slide.kind === "memory-audio" || slide.kind === "highlight-reel") {
      ms = MEDIA_FALLBACK_MS[slide.kind];
    }
    if (!ms) return;

    const timer = setTimeout(goNext, ms);
    return () => clearTimeout(timer);
  }, [started, paused, index, slide, goNext]);

  // Keyboard controls.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!started) return;
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === " ") {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (e.key.toLowerCase() === "f") {
        toggleFullscreen();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, goNext, goPrev]);

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  function scheduleHideControls() {
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    setControlsVisible(true);
    hideControlsTimer.current = setTimeout(() => setControlsVisible(false), 4000);
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await containerRef.current?.requestFullscreen();
      }
    } catch {
      // Fullscreen isn't available in every environment (e.g. some iOS
      // browsers) — the slideshow still works fine windowed.
    }
  }

  function handleBegin() {
    setStarted(true);
    scheduleHideControls();
    toggleFullscreen();
  }

  if (!slide) {
    // Empty deck (no gallery/timeline/memories yet) or, defensively, an
    // out-of-range index — noUncheckedIndexedAccess means `slides[index]`
    // is always `DisplaySlide | undefined` to the type checker even
    // though goNext/goPrev keep it in range whenever slides.length > 0.
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-navy-950 text-center text-ivory-100">
        <Sparkles className="text-gold-400" size={36} />
        <p className="font-display text-2xl">Memories will appear here soon</p>
        <p className="max-w-md text-sm text-ivory-100/60">
          Once photos are added to the Gallery, the Timeline is filled in, or relatives share a
          memory, they&rsquo;ll play here automatically.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={scheduleHideControls}
      onClick={() => started && scheduleHideControls()}
      className="relative h-screen w-screen overflow-hidden bg-navy-950 text-ivory-100"
    >
      <AnimatePresence mode="sync">
        <motion.div
          key={slide.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0"
        >
          <Slide slide={slide} active={started} onMediaEnded={goNext} />
        </motion.div>
      </AnimatePresence>

      {!started ? (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-navy-950/90 text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-gold-400">Celebration Memories</p>
          <button
            type="button"
            onClick={handleBegin}
            className="tap-target flex items-center gap-2 rounded-full border border-gold-500/40 bg-gold-500/10 px-8 py-4 font-display text-xl text-gold-300 transition-luxury duration-300 hover:bg-gold-500/20"
          >
            <Play size={22} /> Tap to Begin
          </button>
          <p className="max-w-sm text-xs text-ivory-100/50">
            Plays photos, videos, voice messages, and notes on a loop — perfect for a TV or
            projector at the venue.
          </p>
        </div>
      ) : null}

      {started ? (
        <div
          className={`absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-3 px-6 pb-6 transition-opacity duration-500 ${
            controlsVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="flex max-w-[80vw] flex-wrap items-center justify-center gap-1.5">
            {slides.map((s, i) => (
              <span
                key={s.id}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === index ? "w-6 bg-gold-400" : "w-1.5 bg-ivory-100/25"
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? "Play" : "Pause"}
              className="tap-target flex h-10 w-10 items-center justify-center rounded-full border border-ivory-100/20 bg-navy-950/60 text-ivory-100 hover:border-gold-400"
            >
              {paused ? <Play size={16} /> : <Pause size={16} />}
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              className="tap-target flex h-10 w-10 items-center justify-center rounded-full border border-ivory-100/20 bg-navy-950/60 text-ivory-100 hover:border-gold-400"
            >
              {isFullscreen ? <Minimize size={16} /> : <Expand size={16} />}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SlideEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs uppercase tracking-[0.4em] text-gold-400">{children}</p>
  );
}

function Slide({
  slide,
  active,
  onMediaEnded,
}: {
  slide: DisplaySlide;
  active: boolean;
  onMediaEnded: () => void;
}) {
  if (slide.kind === "title") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-6 bg-gradient-to-b from-navy-950 via-navy-900 to-navy-950 px-10 text-center">
        <SlideEyebrow>{slide.hostedBy} warmly invites you to celebrate</SlideEyebrow>
        <h1 className="font-display text-6xl text-ivory-50 sm:text-8xl">{slide.honoreeName}</h1>
        <div className="h-px w-24 bg-gold-500/60" />
        <p className="font-display text-2xl text-gold-300 sm:text-3xl">{slide.eventTitle}</p>
        {slide.occasionDate ? (
          <p className="text-sm tracking-[0.2em] text-ivory-100/50">
            {formatEventDate(slide.occasionDate)}
          </p>
        ) : null}
      </div>
    );
  }

  if (slide.kind === "highlight-reel") {
    return (
      <div className="relative h-full w-full bg-navy-950">
        <video
          key={slide.url}
          src={slide.url}
          autoPlay={active}
          playsInline
          onEnded={onMediaEnded}
          className="h-full w-full object-contain"
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-navy-950/80 to-transparent px-10 pb-16 pt-8">
          <SlideEyebrow>Highlight Reel</SlideEyebrow>
        </div>
      </div>
    );
  }

  if (slide.kind === "gallery-photo") {
    return (
      <MediaBackdrop url={slide.url} alt={slide.caption ?? "A cherished photo"}>
        {slide.caption ? <SlideCaption>{slide.caption}</SlideCaption> : null}
      </MediaBackdrop>
    );
  }

  if (slide.kind === "timeline") {
    if (slide.imageUrl) {
      return (
        <MediaBackdrop url={slide.imageUrl} alt={slide.title}>
          <SlideEyebrow>{slide.period}</SlideEyebrow>
          <p className="mt-2 font-display text-3xl text-ivory-50 sm:text-4xl">{slide.title}</p>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ivory-100/75 sm:text-base">
            {slide.description}
          </p>
        </MediaBackdrop>
      );
    }
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-navy-950 px-10 text-center">
        <SlideEyebrow>{slide.period}</SlideEyebrow>
        <p className="font-display text-4xl text-ivory-50 sm:text-5xl">{slide.title}</p>
        <p className="max-w-2xl text-base leading-relaxed text-ivory-100/70 sm:text-lg">
          {slide.description}
        </p>
      </div>
    );
  }

  if (slide.kind === "memory-photo") {
    return (
      <MediaBackdrop url={slide.url} alt={slide.caption ?? `A memory from ${slide.authorName}`}>
        {slide.caption ? <SlideCaption>{slide.caption}</SlideCaption> : null}
        <AuthorTag name={slide.authorName} />
      </MediaBackdrop>
    );
  }

  if (slide.kind === "memory-video") {
    return (
      <div className="relative h-full w-full bg-navy-950">
        <video
          key={slide.url}
          src={slide.url}
          autoPlay={active}
          playsInline
          onEnded={onMediaEnded}
          className="h-full w-full object-contain"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy-950/90 to-transparent px-10 pb-12 pt-24">
          <AuthorTag name={slide.authorName} />
        </div>
      </div>
    );
  }

  if (slide.kind === "memory-audio") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-8 bg-gradient-to-b from-navy-900 to-navy-950 px-10 text-center">
        <SlideEyebrow>A voice message</SlideEyebrow>
        <p className="font-display text-4xl text-ivory-50 sm:text-5xl">{slide.authorName}</p>
        <audio key={slide.url} src={slide.url} autoPlay={active} onEnded={onMediaEnded} className="w-full max-w-md" controls />
      </div>
    );
  }

  // memory-note
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 bg-gradient-to-b from-navy-950 via-navy-900 to-navy-950 px-10 text-center">
      {slide.thumbnailUrl ? (
        <div className="relative mb-2 h-40 w-40 overflow-hidden rounded-2xl border border-gold-500/20 sm:h-56 sm:w-56">
          <Image src={slide.thumbnailUrl} alt="" fill className="object-cover" />
        </div>
      ) : (
        <Quote className="text-gold-500/50" size={40} />
      )}
      <p className="max-w-3xl font-display text-3xl italic leading-snug text-ivory-50 sm:text-4xl">
        &ldquo;{slide.message}&rdquo;
      </p>
      <AuthorTag name={slide.authorName} country={slide.country} />
    </div>
  );
}

function MediaBackdrop({
  url,
  alt,
  children,
}: {
  url: string;
  alt: string;
  children?: ReactNode;
}) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-navy-950">
      <motion.div
        initial={{ scale: 1 }}
        animate={{ scale: 1.08 }}
        transition={{ duration: 9, ease: "linear" }}
        className="absolute inset-0"
      >
        <Image src={url} alt={alt} fill sizes="100vw" className="object-cover" priority={false} />
      </motion.div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy-950/90 to-transparent px-10 pb-12 pt-32" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 px-10 pb-10">{children}</div>
    </div>
  );
}

function SlideCaption({ children }: { children: ReactNode }) {
  return <p className="mb-2 max-w-xl text-lg text-ivory-50 sm:text-xl">{children}</p>;
}

function AuthorTag({ name, country }: { name: string; country?: string | null }) {
  return (
    <p className="flex items-center gap-2 text-sm tracking-wide text-gold-300">
      <Heart size={14} className="fill-gold-400 text-gold-400" />
      Shared by {name}
      {country ? ` · ${country}` : ""}
    </p>
  );
}

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

import { formatCalendarDate } from "@/lib/timezone";
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

/**
 * Safety ceiling for video/audio slides in case `onEnded` never fires
 * (bad file, stalled network, etc.) — advances anyway so the loop can't
 * get stuck. Set generously: guest videos can be several minutes long
 * (a 3:14 video was being cut off at the old 60 s limit). The normal
 * path is always onEnded firing first — this is just the fallback.
 */
const MEDIA_FALLBACK_MS: Record<string, number> = {
  "memory-video": 600_000,  // 10 min — covers even long family videos
  "memory-audio": 300_000,  // 5 min
  "highlight-reel": 600_000,
};

function noteDurationMs(message: string): number {
  // ~200 wpm reading pace — give enough time to read the whole message,
  // clamped to 8 s minimum and 40 s maximum so long notes don't stall the loop.
  const words = message.trim().split(/\s+/).length;
  const readingMs = Math.round((words / 200) * 60_000);
  return Math.min(Math.max(8_000, readingMs), 40_000);
}

/** Picks a Tailwind text-size class that fits the message comfortably on screen. */
function noteTextSizeClass(message: string): string {
  if (message.length <= 200) return "text-3xl sm:text-4xl";
  if (message.length <= 500) return "text-2xl sm:text-3xl";
  if (message.length <= 1200) return "text-xl sm:text-2xl";
  return "text-lg sm:text-xl";
}

/**
 * Estimated duration for a single slide used to calculate the total
 * show length. For photo/note/timeline slides this matches the auto-
 * advance timer exactly. For media slides we don't know the real duration
 * until the browser loads the file, so we use sensible averages — the
 * total shown is always labelled "~" to make the estimate clear.
 */
function estimateSlideDurationMs(s: DisplaySlide): number {
  switch (s.kind) {
    case "title":          return DURATIONS_MS["title"]!;
    case "gallery-photo":  return DURATIONS_MS["gallery-photo"]!;
    case "timeline":       return DURATIONS_MS["timeline"]!;
    case "memory-photo":   return DURATIONS_MS["memory-photo"]!;
    case "memory-note":    return noteDurationMs(s.message);
    case "memory-video":   return 90_000;   // ~1.5 min average guest video
    case "memory-audio":   return 60_000;   // ~1 min average voice message
    case "highlight-reel": return 180_000;  // ~3 min average highlight reel
  }
}

function formatHMS(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Returns a short human-readable label for a slide — shown in the dot tooltip on hover. */
function slideLabel(s: DisplaySlide): string {
  switch (s.kind) {
    case "title":          return s.honoreeName;
    case "highlight-reel": return "Highlight Reel";
    case "gallery-photo":  return s.caption || "Gallery Photo";
    case "timeline":       return s.title;
    case "memory-photo":   return `📷 ${s.authorName}${s.caption ? ` — ${s.caption}` : ""}`;
    case "memory-video":   return `🎬 ${s.authorName}${s.caption ? ` — ${s.caption}` : ""}`;
    case "memory-audio":   return `🎙️ ${s.authorName}${s.caption ? ` — ${s.caption}` : ""}`;
    case "memory-note":    return `💬 ${s.authorName}`;
  }
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
  const [elapsedMs, setElapsedMs] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const filmstripRef = useRef<HTMLDivElement>(null);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalEstimatedMs = slides.reduce((sum, s) => sum + estimateSlideDurationMs(s), 0);

  // Live elapsed-time clock — ticks every second while the show is running.
  useEffect(() => {
    if (!started || paused) return;
    const interval = setInterval(() => setElapsedMs((ms) => ms + 1000), 1000);
    return () => clearInterval(interval);
  }, [started, paused]);

  // Auto-scroll filmstrip to keep the active thumbnail centred.
  useEffect(() => {
    const strip = filmstripRef.current;
    if (!strip) return;
    const thumb = strip.children[index] as HTMLElement | undefined;
    if (!thumb) return;
    strip.scrollTo({
      left: thumb.offsetLeft - strip.clientWidth / 2 + thumb.offsetWidth / 2,
      behavior: "smooth",
    });
  }, [index]);

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
          <Slide slide={slide} active={started} paused={paused} onMediaEnded={goNext} />
        </motion.div>
      </AnimatePresence>

      {!started ? (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-navy-950/90 text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-gold-400">EveryMoment</p>
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

      {/* Bottom-left: QR code promo card — scan to open WhatsApp and enquire */}
      <div className="absolute bottom-24 left-4 z-20 flex flex-col items-center gap-1.5 rounded-xl border border-ivory-100/10 bg-navy-950/70 p-2.5 backdrop-blur-sm">
        {/* QR encodes the WhatsApp wa.me link with a pre-filled message */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://api.qrserver.com/v1/create-qr-code/?size=72x72&color=F5F0E8&bgcolor=0A0F1E&data=${encodeURIComponent("https://wa.me/919987982969?text=Hi%20Harshal%2C%20I%20saw%20everymoment.in%20at%20an%20event%20and%20would%20love%20to%20create%20something%20similar%20for%20my%20occasion!")}`}
          alt="Scan to enquire on WhatsApp"
          width={72}
          height={72}
          className="rounded"
        />
        <p className="text-center text-[9px] leading-tight tracking-wide text-ivory-100/60">
          Create yours
        </p>
        <p className="text-center text-[9px] font-semibold tracking-[0.1em] text-gold-400">
          everymoment.in
        </p>
      </div>

      {/* Bottom-right: subtle domain watermark always visible */}
      <a
        href="https://everymoment.in"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-2 right-4 z-20 text-[10px] tracking-[0.15em] text-ivory-100/40 transition-colors duration-300 hover:text-ivory-100/70 pointer-events-auto"
        style={{ textShadow: "0 1px 3px rgba(0,0,0,0.95)" }}
      >
        everymoment.in
      </a>

      {started ? (
        <div
          className={`absolute inset-x-0 bottom-0 z-10 flex flex-col items-end gap-2 pb-3 transition-opacity duration-500 ${
            controlsVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          {/* Thumbnail filmstrip */}
          <div
            ref={filmstripRef}
            className="flex w-full gap-2 overflow-x-auto scroll-smooth px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Go to slide ${i + 1}: ${slideLabel(s)}`}
                onClick={() => { setIndex(i); setPaused(false); }}
                className={`relative shrink-0 overflow-hidden rounded-lg border-2 transition-all duration-300 focus:outline-none ${
                  i === index
                    ? "border-gold-400 shadow-[0_0_0_2px_rgba(234,179,8,0.35)] scale-105"
                    : "border-transparent opacity-50 hover:opacity-80"
                }`}
                style={{ width: 72, height: 48 }}
              >
                <SlideThumbnail slide={s} />
              </button>
            ))}
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-3 px-4">
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? "Play" : "Pause"}
              className="tap-target flex h-10 w-10 items-center justify-center rounded-full border border-ivory-100/20 bg-navy-950/60 text-ivory-100 hover:border-gold-400"
            >
              {paused ? <Play size={16} /> : <Pause size={16} />}
            </button>

            {/* Elapsed / estimated total timer */}
            <div className="rounded-full border border-ivory-100/15 bg-navy-950/60 px-3 py-1.5 font-mono text-xs tabular-nums text-ivory-100/70">
              <span className="text-ivory-100">{formatHMS(elapsedMs)}</span>
              <span className="mx-1 text-ivory-100/40">/</span>
              <span>~{formatHMS(totalEstimatedMs)}</span>
            </div>

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

/**
 * Captures the first readable video frame via a hidden <video>+<canvas> pair
 * and shows it as the thumbnail. Falls back to a play-icon while loading.
 */
function VideoFrameThumbnail({ url }: { url: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    function capture() {
      if (cancelled) return;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 144;
        canvas.height = 96;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(video, 0, 0, 144, 96);
        const thumb = canvas.toDataURL("image/jpeg", 0.7);
        // A blank (all-black) frame returns a very short dataUrl — retry a bit further in
        if (thumb.length > 5000) {
          setDataUrl(thumb);
        } else if (video.duration && video.currentTime < video.duration * 0.3) {
          video.currentTime = Math.min(video.currentTime + 2, video.duration * 0.3);
        }
      } catch {
        // CORS / codec issue — leave null (fallback icon shows)
      }
    }

    video.addEventListener("loadedmetadata", () => {
      video.currentTime = Math.min(2, video.duration * 0.05 || 2);
    });
    video.addEventListener("seeked", capture);
    video.load();

    return () => {
      cancelled = true;
      video.src = "";
    };
  }, [url]);

  if (dataUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={dataUrl} alt="" className="h-full w-full object-cover" />;
  }
  return (
    <div className="relative h-full w-full bg-navy-900">
      <div className="absolute inset-0 flex items-center justify-center text-ivory-100/50">
        <Play size={18} />
      </div>
    </div>
  );
}

/**
 * Small thumbnail shown in the filmstrip strip for each slide.
 * Uses the slide's image URL when available; falls back to an icon.
 */
function SlideThumbnail({ slide }: { slide: DisplaySlide }) {
  const iconCls = "absolute inset-0 flex items-center justify-center text-ivory-100/60";

  if (slide.kind === "gallery-photo" || slide.kind === "memory-photo") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={slide.url} alt="" className="h-full w-full object-cover" />
    );
  }
  if (slide.kind === "memory-video") {
    return <VideoFrameThumbnail url={slide.url} />;
  }
  if (slide.kind === "highlight-reel") {
    return (
      <div className="h-full w-full bg-navy-900">
        <div className={iconCls}><Sparkles size={16} /></div>
      </div>
    );
  }
  if (slide.kind === "memory-audio") {
    return (
      <div className="h-full w-full bg-navy-900">
        <div className={iconCls}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5 text-ivory-100/60">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
          </svg>
        </div>
      </div>
    );
  }
  if (slide.kind === "memory-note") {
    if (slide.thumbnailUrl) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={slide.thumbnailUrl} alt="" className="h-full w-full object-cover" />;
    }
    return (
      <div className="h-full w-full bg-navy-900">
        <div className={iconCls}><Quote size={16} /></div>
      </div>
    );
  }
  if (slide.kind === "timeline") {
    if (slide.imageUrl) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={slide.imageUrl} alt="" className="h-full w-full object-cover" />;
    }
    return (
      <div className="h-full w-full bg-navy-900">
        <div className={iconCls}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5 text-ivory-100/60">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
        </div>
      </div>
    );
  }
  // title slide
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-navy-900 to-navy-950">
      <Heart size={16} className="fill-gold-400 text-gold-400" />
    </div>
  );
}

function Slide({
  slide,
  active,
  paused,
  onMediaEnded,
}: {
  slide: DisplaySlide;
  active: boolean;
  paused: boolean;
  onMediaEnded: () => void;
}) {
  if (slide.kind === "title") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-6 bg-gradient-to-b from-navy-950 via-navy-900 to-navy-950 px-10 text-center">
        <SlideEyebrow>{slide.hostedBy} warmly invites you to celebrate</SlideEyebrow>
        <h1 className="font-display text-7xl text-ivory-50 sm:text-9xl">{slide.honoreeName}</h1>
        <div className="h-px w-24 bg-gold-500/60" />
        <p className="font-display text-2xl text-gold-300 sm:text-3xl">{slide.eventTitle}</p>
        {slide.occasionDate ? (
          <p className="text-sm tracking-[0.2em] text-ivory-100/50">
            {formatCalendarDate(slide.occasionDate)}
          </p>
        ) : null}
      </div>
    );
  }

  if (slide.kind === "highlight-reel") {
    return (
      <ControlledVideo
        url={slide.url}
        active={active}
        paused={paused}
        onMediaEnded={onMediaEnded}
        className="h-full w-full object-contain"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-navy-950/80 to-transparent px-10 pb-16 pt-8">
          <SlideEyebrow>Highlight Reel</SlideEyebrow>
        </div>
      </ControlledVideo>
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
      <ControlledVideo
        url={slide.url}
        active={active}
        paused={paused}
        onMediaEnded={onMediaEnded}
        className="h-full w-full object-contain"
      >
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy-950/90 to-transparent px-10 pb-32 pt-24">
          {slide.caption ? <SlideCaption>{slide.caption}</SlideCaption> : null}
          <AuthorTag name={slide.authorName} />
        </div>
      </ControlledVideo>
    );
  }

  if (slide.kind === "memory-audio") {
    return (
      <ControlledAudio
        url={slide.url}
        active={active}
        paused={paused}
        onMediaEnded={onMediaEnded}
      >
        <SlideEyebrow>A voice message</SlideEyebrow>
        <p className="font-display text-5xl text-ivory-50 sm:text-7xl">{slide.authorName}</p>
        {slide.caption ? (
          <p className="max-w-xl text-base italic leading-relaxed text-ivory-100/75">&ldquo;{slide.caption}&rdquo;</p>
        ) : null}
      </ControlledAudio>
    );
  }

  // memory-note
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 bg-gradient-to-b from-navy-950 via-navy-900 to-navy-950 px-10 py-16 text-center">
      {slide.thumbnailUrl ? (
        <div className="relative mb-2 h-32 w-32 shrink-0 overflow-hidden rounded-2xl border border-gold-500/20 sm:h-48 sm:w-48">
          <Image src={slide.thumbnailUrl} alt="" fill className="object-cover" />
        </div>
      ) : (
        <Quote className="shrink-0 text-gold-500/50" size={36} />
      )}
      {/* Scrollable container so very long messages never clip — the slide
          duration scales with word count so there's time to read it all. */}
      <div className="max-h-[55vh] w-full max-w-4xl overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <p className={`font-display italic leading-relaxed text-ivory-50 ${noteTextSizeClass(slide.message)}`}>
          &ldquo;{slide.message}&rdquo;
        </p>
      </div>
      <AuthorTag name={slide.authorName} country={slide.country} />
    </div>
  );
}

/**
 * Video wrapper that correctly responds to play/pause state changes.
 * `autoPlay` only fires on mount; we need to call `.pause()` / `.play()`
 * imperatively when the `paused` prop changes mid-playback.
 */
function ControlledVideo({
  url,
  active,
  paused,
  onMediaEnded,
  className,
  children,
}: {
  url: string;
  active: boolean;
  paused: boolean;
  onMediaEnded: () => void;
  className?: string;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !active) return;
    if (paused) {
      el.pause();
    } else {
      el.play().catch(() => { /* autoplay blocked — leave paused */ });
    }
  }, [active, paused]);

  return (
    <div className="relative h-full w-full bg-navy-950">
      <video
        ref={ref}
        key={url}
        src={url}
        autoPlay={active && !paused}
        playsInline
        onEnded={onMediaEnded}
        className={className}
      />
      {children}
    </div>
  );
}

/**
 * Audio wrapper with the same imperative play/pause control as ControlledVideo.
 */
function ControlledAudio({
  url,
  active,
  paused,
  onMediaEnded,
  children,
}: {
  url: string;
  active: boolean;
  paused: boolean;
  onMediaEnded: () => void;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !active) return;
    if (paused) {
      el.pause();
    } else {
      el.play().catch(() => { /* autoplay blocked */ });
    }
  }, [active, paused]);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-8 bg-gradient-to-b from-navy-900 to-navy-950 px-10 text-center">
      {children}
      <audio
        ref={ref}
        key={url}
        src={url}
        autoPlay={active && !paused}
        onEnded={onMediaEnded}
        className="w-full max-w-md"
        controls
      />
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
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy-950/90 to-transparent px-10 pb-32 pt-32" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 px-10 pb-32">{children}</div>
    </div>
  );
}

function SlideCaption({ children }: { children: ReactNode }) {
  return <p className="mb-2 max-w-xl text-xl text-ivory-50 sm:text-2xl">{children}</p>;
}

function AuthorTag({ name, country }: { name: string; country?: string | null }) {
  return (
    <p className="flex items-center gap-2 text-base tracking-wide text-gold-300 sm:text-lg">
      <Heart size={16} className="fill-gold-400 text-gold-400" />
      Shared by {name}
      {country ? ` · ${country}` : ""}
    </p>
  );
}

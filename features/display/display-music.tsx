"use client";

import { useEffect, useRef } from "react";
import { Volume2, VolumeX } from "lucide-react";

/** Normal volume, and the level it drops to while a slide has its own sound. */
const VOLUME = 0.55;
const DUCKED = 0.06;
const FADE_MS = 900;

interface DisplayMusicProps {
  /** Track chosen on the admin dashboard (services/display-music.ts); null = no music. */
  url: string | null;
  /** True once the display's "Start" tap has happened, while it isn't paused or muted. */
  playing: boolean;
  /** True while the current slide plays its own sound (guest video, voice message, highlight reel). */
  duck: boolean;
}

/**
 * Background music for the Big Screen Display. Loops, starts with the
 * display's Start tap (browsers only allow sound after a tap), pauses with
 * it, and fades down under slides that have their own sound so guests'
 * messages are always heard. iPhones/iPads don't let pages change volume,
 * so there it pauses under those slides instead. Renders nothing when no
 * track is chosen.
 */
export function DisplayMusic({ url, playing, duck }: DisplayMusicProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const volumeWorks = useRef<boolean | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (volumeWorks.current === null) {
      audio.volume = 0.5;
      volumeWorks.current = audio.volume === 0.5;
      audio.volume = VOLUME;
    }
    // Without volume control, "ducking" means pausing.
    const shouldPlay = playing && (volumeWorks.current || !duck);
    if (shouldPlay) void audio.play().catch(() => undefined);
    else audio.pause();
    if (!volumeWorks.current) return;

    const target = duck ? DUCKED : VOLUME;
    const start = audio.volume;
    const began = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - began) / FADE_MS);
      audio.volume = start + (target - start) * t;
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [playing, duck, url]);

  if (!url) return null;
  return <audio ref={audioRef} src={url} loop preload="auto" />;
}

/** Mute button for the display's control row. */
export function MusicToggleButton({ muted, onToggle }: { muted: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={muted ? "Turn music on" : "Turn music off"}
      className="tap-target flex h-10 w-10 items-center justify-center rounded-full border border-ivory-100/20 bg-navy-950/60 text-ivory-100 hover:border-gold-400"
    >
      {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
    </button>
  );
}

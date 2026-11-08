"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import s from "./MusicToggle.module.css";
import { Icon, cx } from "./shared";

/**
 * Background music for an invitation.
 * Give it either `src` (an audio file URL) or `createBuffer` (async fn returning an AudioBuffer).
 * Call `play()` straight from a click handler — browsers only allow sound after a user gesture.
 */
export function useInviteMusic({ src, createBuffer } = {}) {
  const [playing, setPlaying] = useState(false);
  const audio = useRef(null);
  const ctx = useRef(null);
  const started = useRef(false);

  const play = useCallback(() => {
    if (src) {
      audio.current ??= Object.assign(new Audio(src), { loop: true, preload: "auto" });
      audio.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      return;
    }
    const Ctx = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
    if (!createBuffer || !Ctx) return;
    ctx.current ??= new Ctx();
    ctx.current.resume();
    setPlaying(true);
    if (started.current) return;
    started.current = true;
    createBuffer().then((buffer) => {
      if (!ctx.current) return;
      const node = ctx.current.createBufferSource();
      node.buffer = buffer;
      node.loop = true;
      node.connect(ctx.current.destination);
      node.start();
    }).catch(() => { started.current = false; setPlaying(false); });
  }, [src, createBuffer]);

  const pause = useCallback(() => {
    audio.current?.pause();
    ctx.current?.suspend();
    setPlaying(false);
  }, []);

  useEffect(() => () => { audio.current?.pause(); ctx.current?.close(); ctx.current = null; }, []);

  return { playing, play, pause, toggle: () => (playing ? pause() : play()) };
}

/** Floating play / mute button. */
export default function MusicToggle({ playing, onToggle, className }) {
  return <button type="button" className={cx(s.toggle, playing && s.playing, className)} onClick={onToggle} aria-pressed={playing} aria-label={playing ? "Mute music" : "Play music"}>
    <Icon name={playing ? "sound" : "mute"} size={22} />
  </button>;
}

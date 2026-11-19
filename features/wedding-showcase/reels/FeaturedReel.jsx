"use client";
import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { FEATURED_REEL } from "./reel-templates";
import { startReelAction } from "../actions";
import s from "./reels.module.css";

function CreateReel() {
  const { pending } = useFormStatus();
  return <button type="submit" className={s.use} disabled={pending} aria-busy={pending}>{pending ? "Opening the reel studio…" : "Create your own reel ↗"}</button>;
}

/** The sample wedding reel in a phone frame: plays muted on its own, tap for sound; below it, make your own. */
export default function FeaturedReel() {
  const video = useRef(null);
  const [muted, setMuted] = useState(true);
  const toggleSound = () => {
    const v = video.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (v.paused) v.play().catch(() => {});
  };
  return <div className={s.featured}>
    <div className={s.phone}>
      <video ref={video} className={s.video} src={FEATURED_REEL.src} poster={FEATURED_REEL.poster} autoPlay muted loop playsInline preload="metadata" controls={false} onClick={toggleSound} />
      <button type="button" className={s.sound} onClick={toggleSound} aria-label={muted ? "Turn the sound on" : "Turn the sound off"}>{muted ? "🔇 Tap for sound" : "🔊 Sound on"}</button>
    </div>
    <div className={s.info}>
      <p className={s.tag}>Wedding reel · {FEATURED_REEL.length} · 9:16 vertical</p>
      <h2 className={s.title}>{FEATURED_REEL.title}</h2>
      <p className={s.text}>The wax-seal envelope opens onto your story — haldi, cocktail night and the baraat — each scene with its own date, time and place.</p>
      <ul className={s.points}>
        <li>Your names, photos, ceremonies and music</li>
        <li>Ready for Instagram Reels, WhatsApp Status and YouTube Shorts</li>
      </ul>
      <form action={startReelAction}>
        <input type="hidden" name="reel" value={FEATURED_REEL.slug} />
        <CreateReel />
      </form>
    </div>
  </div>;
}

"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { FEATURED_REEL } from "./reel-templates";
import s from "./reels.module.css";


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
  const preview = () => {
    const v = video.current;
    if (!v) return;
    void v.play().catch(() => {});
  };
  const stopPreview = () => {
    const v = video.current;
    if (!v || !v.muted) return;
    v.pause();
    v.currentTime = 0;
  };
  return <div className={s.featured}>
    <div className={s.phone} onMouseEnter={preview} onMouseLeave={stopPreview} onFocus={preview} onBlur={stopPreview}>
      <video ref={video} className={s.video} src={FEATURED_REEL.src} poster={FEATURED_REEL.poster} muted loop playsInline preload="metadata" controls={false} onClick={toggleSound} />
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
      <Link href={`/ai-reel?template=${FEATURED_REEL.slug}`} className={s.use}>Create your own reel ↗</Link>
    </div>
  </div>;
}

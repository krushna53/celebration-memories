"use client";
import { useEffect, useRef, useState } from "react";
import s from "./GallerySection.module.css";
import { Icon, Reveal, Section, SectionHeading, cx } from "./shared";

/** Auto-playing photo slideshow with swipe. photos: [{ src, alt, caption }] */
export default function GallerySection({ id = "gallery", eyebrow = "Moments", title = "Our Story in Pictures", subtitle, photos = [], interval = 4500, tone = "white" }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef(null);
  const count = photos.length;
  const go = (n) => setIndex((n + count) % count);

  useEffect(() => {
    if (paused || count < 2) return;
    const t = window.setTimeout(() => setIndex((i) => (i + 1) % count), interval);
    return () => window.clearTimeout(t);
  }, [index, paused, count, interval]);

  if (!count) return null;
  return <Section id={id} tone={tone} label="Gallery">
    <SectionHeading eyebrow={eyebrow} title={title} subtitle={subtitle} />
    <Reveal className={s.stage} role="region" aria-roledescription="carousel" aria-label="Photo gallery"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; setPaused(true); }}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - (touchX.current ?? 0);
        if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
        setPaused(false);
      }}>
      {photos.map((p, i) => <figure key={p.src} className={cx(s.slide, i === index && s.on)} aria-hidden={i !== index}>
        <img src={p.src} alt={p.alt ?? ""} loading={i === 0 ? "eager" : "lazy"} />
        {p.caption && <figcaption>{p.caption}</figcaption>}
      </figure>)}
      {count > 1 && <>
        <button type="button" className={cx(s.nav, s.prev)} onClick={() => go(index - 1)} aria-label="Previous photo"><Icon name="left" size={22} /></button>
        <button type="button" className={cx(s.nav, s.next)} onClick={() => go(index + 1)} aria-label="Next photo"><Icon name="right" size={22} /></button>
      </>}
    </Reveal>
    {count > 1 && <div className={s.dots}>{photos.map((p, i) => <button type="button" key={p.src} aria-label={`Show photo ${i + 1}`} aria-current={i === index} onClick={() => go(i)} />)}</div>}
  </Section>;
}

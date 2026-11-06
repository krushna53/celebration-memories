"use client";
import { useEffect, useRef, useState } from "react";
import s from "./shared.module.css";

export const cx = (...names) => names.filter(Boolean).join(" ");

/** Fades children in the first time they scroll into view. */
export function Reveal({ as: Tag = "div", className, delay = 0, children, style, ...rest }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setShown(true); return; }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setShown(true); io.disconnect(); }
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <Tag ref={ref} className={cx(s.reveal, shown && s.revealIn, className)} style={{ transitionDelay: `${delay}ms`, ...style }} {...rest}>{children}</Tag>;
}

export function Ornament({ className }) {
  return <div className={cx(s.ornament, className)} aria-hidden="true"><i /><Icon name="heart" size={12} /><i /></div>;
}

/**
 * tone: "light" | "cream" | "white" | "dark"
 * background: optional element (e.g. an <img>) placed behind the content, filling the section.
 */
export function Section({ id, tone = "light", narrow = false, className, innerClassName, label, background, children }) {
  return <section id={id} aria-label={label} className={cx(s.section, tone !== "light" && s[tone], className)}>
    {background}
    <div className={cx(s.inner, narrow && s.narrow, innerClassName)}>{children}</div>
  </section>;
}

export function SectionHeading({ eyebrow, title, subtitle, id }) {
  return <Reveal className={s.heading}>
    {eyebrow && <p className={s.eyebrow}>{eyebrow}</p>}
    {title && <h2 className={s.title} id={id}>{title}</h2>}
    <Ornament />
    {subtitle && <p className={s.subtitle}>{subtitle}</p>}
  </Reveal>;
}

export function Button({ href, variant, className, children, ...rest }) {
  const cls = cx(s.button, variant === "ghost" && s.ghost, className);
  if (href) return <a className={cls} href={href} {...rest}>{children}</a>;
  return <button type="button" className={cls} {...rest}>{children}</button>;
}

const PATHS = {
  heart: <path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.4 4.5 7 4.5c2 0 3.3 1.1 5 3 1.7-1.9 3-3 5-3 3.6 0 5.6 3.5 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2Z" fill="currentColor" stroke="none" />,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  pin: <><path d="M12 21s-6.5-6.1-6.5-11.3a6.5 6.5 0 0 1 13 0C18.5 14.9 12 21 12 21Z" /><circle cx="12" cy="9.7" r="2.4" /></>,
  music: <><path d="M9 18V6l10-2v12" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="16.5" cy="16" r="2.5" /></>,
  mute: <><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="m16 9.5 5 5M21 9.5l-5 5" /></>,
  sound: <><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></>,
  left: <path d="m14.5 6-6 6 6 6" />,
  right: <path d="m9.5 6 6 6-6 6" />,
  down: <path d="m6 9.5 6 6 6-6" />,
  car: <><path d="M4.5 16.5V12l2-5h11l2 5v4.5" /><path d="M3.5 16.5h17v2h-17zM4.5 12h15" /><circle cx="8" cy="14.3" r=".6" /><circle cx="16" cy="14.3" r=".6" /></>,
  bed: <><path d="M3 18.5V6M3 14h18v4.5M21 14v-2.5a3 3 0 0 0-3-3h-7V14" /><circle cx="7" cy="10.7" r="1.8" /></>,
  gift: <><rect x="4" y="9" width="16" height="11" rx="1.5" /><path d="M3 9h18M12 9v11M12 9c-1.5-3.5-5.5-4-5.5-1.5S12 9 12 9Zm0 0c1.5-3.5 5.5-4 5.5-1.5S12 9 12 9Z" /></>,
  leaf: <><path d="M5 19c0-8 5-13 14-14 0 9-5 14-14 14Z" /><path d="M5 19 13 11" /></>,
  plate: <><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="9" /></>,
  dress: <path d="M9 3h6l-1 4 4 13H6l4-13-1-4Z" />,
  suit: <><path d="M8 3h8l3 3-2 15H7L5 6l3-3Z" /><path d="m8 3 4 6 4-6M12 9v12" /></>,
  sparkle: <path d="M12 3l1.8 5.5L19.5 10l-5.7 1.6L12 17l-1.8-5.4L4.5 10l5.7-1.5Z" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  send: <path d="M4 12 20 4l-6 16-2.5-6.5L4 12Z" />,
  flower: <><circle cx="12" cy="12" r="2.3" /><path d="M12 9.7C10 5 14 5 12 9.7ZM12 14.3c-2 4.7 2 4.7 0 0ZM9.7 12c-4.7-2-4.7 2 0 0ZM14.3 12c4.7-2 4.7 2 0 0Z" /><path d="M12 9.5c-1-4.5-4.5-3-2.6.6M12 14.5c1 4.5 4.5 3 2.6-.6M9.5 12c-4.5 1-3 4.5.6 2.6M14.5 12c4.5-1 3-4.5-.6-2.6" /></>,
  rings: <><circle cx="9" cy="14" r="5" /><circle cx="15" cy="14" r="5" /><path d="m10.5 6 1.5-2.5L13.5 6 12 7.5Z" /></>,
  diya: <><path d="M3 13c2 4 16 4 18 0H3Z" /><path d="M12 11c-1.8-1.6-1.3-4 0-6.5 1.3 2.5 1.8 4.9 0 6.5Z" /></>,
  dhol: <><ellipse cx="12" cy="7" rx="7" ry="2.5" /><path d="M5 7v10c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V7" /><path d="m7 9 10 8M17 9 7 17" /></>,
  glass: <><path d="M8 3h8l-.6 6a3.4 3.4 0 0 1-6.8 0L8 3Z" /><path d="M12 12.5V20M8.5 20.5h7" /></>,
};

export function Icon({ name, size = 20, className, strokeWidth = 1.6 }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{PATHS[name] ?? PATHS.sparkle}</svg>;
}

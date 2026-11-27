"use client";
import { createContext, useContext, useEffect, useState } from "react";
import p from "./parts.module.css";

/*
 * Small pieces shared by the showcase's own page layouts (Editorial, Royal scroll, Boarding pass, Scrapbook,
 * Starry night, Modern grid, Arches). They all read the same content `c` that buildInvitation() makes for the
 * Sacred Garden page, so a sample can switch layout without touching its data.
 */

const COUPLE_PHOTOS = [
  "couple-rosewood-vows", "couple-moonlit-courtyard", "couple-lotus-dawn", "couple-orchid-evening",
  "couple-pearl-tide", "couple-tamil-jasmine", "couple-rajasthani-gulabi",
].map((name) => `/art/couples/${name}.webp`);

const hash = (text = "") => [...text].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 7);

/** A couple photo for this sample: its own hero photo for k = 0, else one picked from the names (k picks another). */
export function photoFor(c, k = 0) {
  if (k === 0 && c.hero.photo) return c.hero.photo;
  if (k === 1 && c.storyPhoto) return c.storyPhoto;
  return COUPLE_PHOTOS[(hash(c.couple.first + c.couple.second) + k) % COUPLE_PHOTOS.length];
}

/** Designs with a strip of photos (polaroids, film frames): the editor shows its "Photo gallery" fields for them. */
export const GALLERY_PAGES = ["scrapbook", "filmstrip"];

/** Photo i (0–3) of the couple's gallery, else a sample photo. */
export const galleryPhoto = (c, i) => c.gallery?.[i] || photoFor(c, i + 1);

/** The closing picture: the couple's own closing photo, else another couple photo. */
export const closingPhoto = (c) => c.closing.photo || photoFor(c, 3);

/** Parts of the wedding date and time, in India time (the dates are saved as IST). */
export function when(c) {
  const at = new Date(c.countdown.date);
  const part = (o) => new Intl.DateTimeFormat("en-GB", { ...o, timeZone: "Asia/Kolkata" }).format(at);
  return {
    day: part({ day: "2-digit" }), month: part({ month: "short" }), monthLong: part({ month: "long" }),
    monthNum: part({ month: "2-digit" }), year: part({ year: "numeric" }), yy: part({ year: "2-digit" }),
    weekday: part({ weekday: "long" }), time: part({ hour: "numeric", minute: "2-digit", hour12: true }).replace(" ", " "),
  };
}

/** Schedule rows grouped under their day headings: [{ day, items }]. */
export function byDay(items = []) {
  const out = [];
  for (const item of items) {
    if (item.day || !out.length) out.push({ day: item.day || "", items: [] });
    out[out.length - 1].items.push(item);
  }
  return out;
}

/** "7:30pm onwards" → { time: "7:30pm", onwards: true } */
export const cleanTime = (time = "") => ({ time: time.replace(/\s+onwards$/i, ""), onwards: /\sonwards$/i.test(time) });

/** "Two Hearts\nOne Journey" → lines with <br>. */
export const Lines = ({ text = "" }) => text.split("\n").map((line, i, all) => <span key={i}>{line}{i < all.length - 1 && <br />}</span>);

/** Days / hours / minutes / seconds to the wedding, ticking each second; null until the page is in the browser. */
export function useCountdown(iso) {
  const [now, setNow] = useState(null);
  useEffect(() => {
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  if (now === null) return null;
  const left = Math.max(0, new Date(iso).getTime() - now);
  return { days: Math.floor(left / 864e5), hours: Math.floor(left / 36e5) % 24, minutes: Math.floor(left / 6e4) % 60, seconds: Math.floor(left / 1e3) % 60 };
}

export const COUNT_UNITS = [["days", "Days", 365], ["hours", "Hours", 24], ["minutes", "Minutes", 60], ["seconds", "Seconds", 60]];
export const pad = (n) => (n === undefined ? "--" : String(n).padStart(2, "0"));

/**
 * Pieces marked data-reveal="up | left | right | zoom | tilt | unroll" fade in as they scroll into view, once the
 * page is uncovered (`active`). Guests who ask for reduced motion see everything at once.
 */
export function useReveal(rootRef, active) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !active) return undefined;
    const items = [...root.querySelectorAll("[data-reveal]:not([data-in])")];
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      items.forEach((el) => el.setAttribute("data-in", ""));
      return undefined;
    }
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      e.target.setAttribute("data-in", "");
    }), { rootMargin: "0px 0px -8% 0px", threshold: 0 });
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [rootRef, active]);
}

/** A decorative barcode drawn from the text (same text, same bars). */
export function Barcode({ text = "", className }) {
  const bars = [...`${text}*forever*`].flatMap((ch, i) => [1 + (ch.charCodeAt(0) % 3), 1 + ((ch.charCodeAt(0) + i) % 2)]);
  return <span className={`${p.barcode} ${className ?? ""}`} aria-hidden="true">
    {bars.map((w, i) => <i key={i} style={{ width: `${w}px`, opacity: i % 2 ? 0 : 1 }} />)}
  </span>;
}

/** The venue map with a directions button. */
export function MapFrame({ c, className, buttonClassName }) {
  return <div className={`${p.map} ${className ?? ""}`}>
    <iframe src={c.location.mapEmbed} title={`Map — ${c.location.name}`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
    {c.location.directions && <a className={`${p.directions} ${buttonClassName ?? ""}`} href={c.location.directions} target="_blank" rel="noopener noreferrer">Get directions ↗</a>}
  </div>;
}

/** What the RSVP section shows: true = the form below, false = nothing, or a node (an event's live RSVP) in its place. */
export const RsvpSlot = createContext(true);

/**
 * A short RSVP form. Samples have no endpoint, so a reply only shows the thank-you; with one it is POSTed as a form.
 * tone: "light" (dark text on a light card) or "dark" (light text on a dark card). Colours come from --pg-* variables.
 */
export function Rsvp(props) {
  const slot = useContext(RsvpSlot);
  if (slot === false) return null;
  if (slot !== true) return slot;
  return <RsvpForm {...props} />;
}

function RsvpForm({ c, tone = "light", className, submitLabel }) {
  const [state, setState] = useState("idle"); // idle → sending → sent | failed
  const [coming, setComing] = useState("yes");
  const submit = async (e) => {
    e.preventDefault();
    if (!c.rsvp.endpoint) { setState("sent"); return; }
    setState("sending");
    try {
      const res = await fetch(c.rsvp.endpoint, { method: "POST", body: new FormData(e.currentTarget) });
      setState(res.ok ? "sent" : "failed");
    } catch { setState("failed"); }
  };
  if (state === "sent") return <div className={`${p.rsvp} ${p[tone]} ${p.thanks} ${className ?? ""}`} role="status">
    <span className={p.tick} aria-hidden="true">✓</span>
    <p>{c.rsvp.success}</p>
  </div>;
  return <form className={`${p.rsvp} ${p[tone]} ${className ?? ""}`} onSubmit={submit}>
    <label className={p.field}><span>Your name</span><input name="name" required autoComplete="name" placeholder="As it should appear on the guest list" /></label>
    <fieldset className={p.choice}>
      <legend>Will you be attending?</legend>
      {[["yes", "Joyfully accepts"], ["no", "Regretfully declines"]].map(([value, label]) => <label key={value} className={coming === value ? p.on : undefined}>
        <input type="radio" name="attending" value={label} checked={coming === value} onChange={() => setComing(value)} />{label}
      </label>)}
    </fieldset>
    {coming === "yes" && <label className={p.field}><span>Guests in your party</span>
      <select name="guests" defaultValue="2">{[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}</select>
    </label>}
    <label className={p.field}><span>A note for the couple <small>(optional)</small></span><textarea name="note" rows={2} placeholder="Wishes, a song request, dietary needs…" /></label>
    {c.rsvp.note && <p className={p.deadline}>Kindly reply by {c.rsvp.note}</p>}
    <button type="submit" className={p.send} disabled={state === "sending"}>{state === "sending" ? "Sending…" : submitLabel || "Send RSVP"}</button>
    {state === "failed" && <p className={p.error} role="alert">{c.rsvp.failure}</p>}
  </form>;
}

/** The closing film or photo. */
export function ClosingMedia({ c, className }) {
  return c.closing.video
    ? <video className={className} src={c.closing.video} autoPlay muted loop playsInline preload="metadata" />
    : <img className={className} src={closingPhoto(c)} alt={`${c.couple.first} and ${c.couple.second}`} loading="lazy" />;
}

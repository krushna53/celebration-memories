"use client";
import "@/features/wedding-showcase/showcase-fonts.css";
import "@/features/sacred-garden/components/garden/sacred-fonts.css";
import { useState } from "react";
import { CARDS, CARD_TAGS, TEMPLATE_STORE_URL } from "./card-templates";
import s from "./cards.module.css";

/** One invitation card drawn in CSS; the pointer tilts it and moves a light sheen across it. */
function Card({ card }) {
  const [a, b] = card.couple;
  const tilt = (e) => {
    const el = e.currentTarget, r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--rx", `${(0.5 - y) * 10}deg`);
    el.style.setProperty("--ry", `${(x - 0.5) * 12}deg`);
    el.style.setProperty("--mx", `${x * 100}%`);
    el.style.setProperty("--my", `${y * 100}%`);
  };
  const reset = (e) => { ["--rx", "--ry"].forEach((k) => e.currentTarget.style.setProperty(k, "0deg")); };
  return <a className={s.item} href={TEMPLATE_STORE_URL} onPointerMove={tilt} onPointerLeave={reset} aria-label={`${card.title} invitation card — personalise this template`}>
    <span className={`${s.card} ${s[card.style] ?? ""}`}>
      <span className={s.art} aria-hidden="true"><i /><i /><i /></span>
      {card.style === "snapshot" && <img className={s.photo} src="/art/couples/couple-orchid-evening.webp" alt="" loading="lazy" />}
      <span className={s.content}>
        <span className={s.kicker}>{card.kicker}</span>
        <span className={s.names}><span>{a}</span><em>&amp;</em><span>{b}</span></span>
        <span className={s.rule} aria-hidden="true" />
        <span className={s.date}>{card.date}</span>
        <span className={s.venue}>{card.venue}</span>
      </span>
      <span className={s.sheen} aria-hidden="true" />
    </span>
    <span className={s.info}>
      <span className={s.tag}>{card.tag}</span>
      <span className={s.title}>{card.title}</span>
      {card.note && <span className={s.note}>{card.note}</span>}
      <span className={s.cta}>Personalise this card ↗</span>
    </span>
  </a>;
}

/** The invitation card templates, filterable by style; every card opens the template store. */
export default function CardGallery() {
  const [tag, setTag] = useState("All");
  const shown = tag === "All" ? CARDS : CARDS.filter((card) => card.tag === tag);
  return <>
    <div className={s.filters} role="group" aria-label="Filter cards by style">
      {CARD_TAGS.map((t) => <button key={t} type="button" aria-pressed={t === tag} className={t === tag ? s.chipOn : s.chip} onClick={() => setTag(t)}>{t}</button>)}
    </div>
    <div className={s.grid}>{shown.map((card) => <Card key={card.slug} card={card} />)}</div>
  </>;
}

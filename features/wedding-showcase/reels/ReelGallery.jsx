"use client";
import Link from "next/link";
import TemplateReel from "./TemplateReel";
import { REEL_TEMPLATES } from "./reel-templates";
import s from "./reels.module.css";

/** Live, animated reel templates; each opens the reel studio pre-filled so every word can be edited. */
export default function ReelGallery() {
  return <section className={s.gallery} aria-labelledby="reel-templates">
    <div className={s.galleryHead}>
      <p className={s.tag}>Reel templates</p>
      <h2 id="reel-templates" className={s.title}>Pick a style, make it yours</h2>
      <p className={s.text}>Each reel below is playing live. Open one in the studio to change the names, dates, ceremonies and photos — or let AI create a fresh film in the same mood.</p>
    </div>
    <div className={s.grid}>
      {REEL_TEMPLATES.map((template) => <article key={template.slug} className={s.card}>
        <Link href={`/ai-reel?template=${template.slug}`} className={s.cardPhone} aria-label={`Open ${template.title} in the reel studio`}>
          <TemplateReel template={template} />
        </Link>
        <p className={s.cardTag}>{template.tag} · {template.length}</p>
        <h3 className={s.cardTitle}>{template.title}</h3>
        <p className={s.cardText}>{template.blurb}</p>
        <Link href={`/ai-reel?template=${template.slug}`} className={s.cardUse}>Use this template</Link>
      </article>)}
    </div>
  </section>;
}

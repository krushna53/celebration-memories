"use client";
import s from "./DressCodeSection.module.css";
import { Icon, Reveal, Section, SectionHeading } from "./shared";
import { useT } from "./i18n";

/** Dress code for women / men plus an optional colour palette: [{ name, color }]. tone: "dark" | "light" | "cream" | "white" */
export default function DressCodeSection({ id = "dress-code", eyebrow = "What to wear", title = "Dress Code", subtitle, women, men, palette = [], paletteLabel = "Colours we love", tone = "dark" }) {
  const t = useT();
  return <Section id={id} tone={tone} className={tone !== "dark" ? s.light : undefined} label="Dress code">
    <SectionHeading eyebrow={eyebrow} title={title} subtitle={subtitle} />
    <div className={s.grid}>
      {women && <Reveal className={s.card}><span className={s.icon}><Icon name="dress" size={28} /></span><h3>{t("women")}</h3><p>{women}</p></Reveal>}
      {men && <Reveal className={s.card} delay={120}><span className={s.icon}><Icon name="suit" size={28} /></span><h3>{t("men")}</h3><p>{men}</p></Reveal>}
    </div>
    {palette.length > 0 && <Reveal className={s.palette} delay={200}>
      <p>{paletteLabel}</p>
      <ul className={s.swatches}>{palette.map((c) => <li key={c.name}><span style={{ background: c.color }} />{c.name}</li>)}</ul>
    </Reveal>}
  </Section>;
}

"use client";
import s from "./MenuSection.module.css";
import { Reveal, Section, SectionHeading, cx } from "./shared";

/** Veg food menu. veg: array of dish names. */
export default function MenuSection({ id = "menu", eyebrow = "Dinner is served", title = "Menu", subtitle, veg = [], vegLabel = "Veg", tone = "cream" }) {
  if (!veg.length) return null;
  return <Section id={id} tone={tone} label="Menu">
    <SectionHeading eyebrow={eyebrow} title={title} subtitle={subtitle} />
    <div className={s.grid}>
      <Reveal className={cx(s.card, s.veg)}>
        <h3 className={s.head}><span className={s.badge} aria-hidden="true" />{vegLabel}</h3>
        <ul className={s.list}>{veg.map((dish) => <li key={dish}>{dish}</li>)}</ul>
      </Reveal>
    </div>
  </Section>;
}

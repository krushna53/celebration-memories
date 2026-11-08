"use client";
import s from "./GuestInfoSection.module.css";
import { Icon, Reveal, Section, SectionHeading } from "./shared";

/**
 * Practical info cards — transportation, accommodation, gifts, anything else.
 * items: [{ icon, title, text, link: { href, label } }]
 */
export default function GuestInfoSection({ id = "guest-info", eyebrow = "Good to know", title = "Guest Information", subtitle, items = [], tone = "light" }) {
  return <Section id={id} tone={tone} label="Guest information">
    <SectionHeading eyebrow={eyebrow} title={title} subtitle={subtitle} />
    <div className={s.grid}>
      {items.map((item, i) => <Reveal as="article" key={item.title} className={s.card} delay={i * 100}>
        <span className={s.icon}><Icon name={item.icon} size={24} /></span>
        <h3>{item.title}</h3>
        <p>{item.text}</p>
        {item.link && <a href={item.link.href} target="_blank" rel="noopener noreferrer">{item.link.label}</a>}
      </Reveal>)}
    </div>
  </Section>;
}

"use client";
import s from "./ProgramTimelineSection.module.css";
import { Icon, Reveal, Section, SectionHeading } from "./shared";

/** Order of the day. items: [{ time, title, detail, icon }] */
export default function ProgramTimelineSection({ id = "program", eyebrow = "The wedding day", title = "Program Timeline", subtitle, items = [], tone = "cream" }) {
  return <Section id={id} tone={tone} label="Program timeline">
    <SectionHeading eyebrow={eyebrow} title={title} subtitle={subtitle} />
    <ol className={s.list}>
      {items.map((item, i) => <Reveal as="li" key={`${item.time}-${item.title}`} className={s.item} delay={i * 70}>
        <span className={s.dot}><Icon name={item.icon ?? "heart"} size={16} /></span>
        <span className={s.time}>{item.time}</span>
        <div className={s.body}><h3>{item.title}</h3>{item.detail && <p>{item.detail}</p>}</div>
      </Reveal>)}
    </ol>
  </Section>;
}

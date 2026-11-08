"use client";
import s from "./EventsSection.module.css";
import { Icon, Reveal, Section, SectionHeading, cx } from "./shared";
import { useT } from "./i18n";

/**
 * Cards for each function.
 * events: [{ name, icon, date, time, venue, note, mapUrl, highlight }]
 * icon: any name from shared Icon (flower, diya, dhol, rings, glass, …)
 */
export default function EventsSection({ id = "events", eyebrow = "Join us for", title = "The Celebrations", subtitle, events = [], tone = "light" }) {
  const t = useT();
  return <Section id={id} tone={tone} label="Events">
    <SectionHeading eyebrow={eyebrow} title={title} subtitle={subtitle} />
    <div className={s.grid}>
      {events.map((ev, i) => <Reveal as="article" key={ev.name} delay={(i % 3) * 110} className={cx(s.card, ev.highlight && s.main)}>
        <span className={s.icon}><Icon name={ev.icon} size={28} /></span>
        <h3 className={s.name}>{ev.name}</h3>
        <ul className={s.meta}>
          <li className={s.date}><Icon name="calendar" size={15} />{ev.date}</li>
          {ev.time && <li><Icon name="clock" size={15} />{ev.time}</li>}
          {ev.venue && <li><Icon name="pin" size={15} />{ev.venue}</li>}
        </ul>
        {ev.note && <p className={s.note}>{ev.note}</p>}
        {ev.mapUrl && <a className={s.map} href={ev.mapUrl} target="_blank" rel="noopener noreferrer">{t("getDirections")}</a>}
      </Reveal>)}
    </div>
  </Section>;
}

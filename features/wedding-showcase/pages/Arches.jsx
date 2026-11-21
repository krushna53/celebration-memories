"use client";
import { byDay, cleanTime, photoFor, when, useCountdown, COUNT_UNITS, pad, Lines, MapFrame, Rsvp, ClosingMedia } from "./parts";
import s from "./Arches.module.css";

/** Hanging lanterns that sway either side of the main arch. */
const Lanterns = () => <div className={s.lanterns} aria-hidden="true">{[0, 1, 2, 3].map((i) => <i key={i} style={{ "--i": i, "--len": `${[70, 110, 120, 80][i]}px` }}><b /></i>)}</div>;

/** Arches & lattice: every section framed in an arched window over a jali pattern, events as a row of arched cards. */
export default function Arches({ c }) {
  const w = when(c);
  const count = useCountdown(c.countdown.date);
  const days = byDay(c.schedule.items);
  const { first, second } = c.couple;
  return <div className={s.court}>
    <section id="pg-arch" className={s.hero}>
      <Lanterns />
      {c.welcome.blessing && <p className={s.blessing}>{c.welcome.blessing}</p>}
      <div className={s.mainArch} data-reveal="zoom">
        <img src={photoFor(c)} alt={`${first} and ${second}`} />
      </div>
      <h1 className={s.names}>{first} <span>&amp;</span> {second}</h1>
      <p className={s.date}><span>{w.weekday}</span>{c.hero.date}<span>{w.time}</span></p>
    </section>

    <section id="pg-welcome" className={s.section}>
      <div className={s.window} data-reveal="up">
        <h2 className={s.title}><Lines text={c.welcome.title} /></h2>
        {c.welcome.message && <p className={s.text}>{c.welcome.message}</p>}
        {(c.couple.firstParents || c.couple.secondParents) && <div className={s.parents}>
          {c.couple.firstParents && <p><b>{first}</b>{c.couple.firstParents}</p>}
          {c.couple.secondParents && <p><b>{second}</b>{c.couple.secondParents}</p>}
        </div>}
      </div>
    </section>

    <section id="pg-countdown" className={s.section}>
      <h2 className={s.title} data-reveal="up">{c.countdown.title}</h2>
      <div className={s.domes}>
        {COUNT_UNITS.map(([key, label], i) => <div key={key} data-reveal="up" style={{ "--d": `${i * 0.08}s` }}><b>{pad(count?.[key])}</b><span>{label}</span></div>)}
      </div>
    </section>

    <section id="pg-events" className={s.section}>
      <h2 className={s.title} data-reveal="up">{c.schedule.title}</h2>
      {days.map(({ day, items }, d) => <div key={d} className={s.dayGroup}>
        {day && <h3 className={s.day} data-reveal="up">{day}</h3>}
        <div className={s.cards}>
          {items.map((item, i) => {
            const t = cleanTime(item.time);
            return <article key={i} className={s.card} data-reveal="up" style={{ "--d": `${i * 0.08}s` }}>
              <span className={s.cardNo}>{String(i + 1).padStart(2, "0")}</span>
              <h4>{item.title}</h4>
              <p className={s.cardTime}>{t.time}{t.onwards && <small>onwards</small>}</p>
              {item.location && <p className={s.cardPlace}>{item.location}</p>}
            </article>;
          })}
        </div>
      </div>)}
    </section>

    <section id="pg-venue" className={s.section}>
      <div className={s.venue}>
        <div className={s.venueArch} data-reveal="left"><img src={c.location.image || photoFor(c, 1)} alt={c.location.name} loading="lazy" /></div>
        <div data-reveal="right">
          <p className={s.kicker}>{c.location.title}</p>
          <h2 className={s.venueName}>{c.location.name}</h2>
          <p className={s.text}>{c.location.address}</p>
        </div>
      </div>
      <MapFrame c={c} className={s.map} />
    </section>

    {(c.dressCode.text || c.gifts.text) && <section id="pg-notes" className={`${s.section} ${s.pair}`}>
      {c.dressCode.text && <div className={s.window} data-reveal="up"><h3 className={s.small}>{c.dressCode.title}</h3><p className={s.text}>{c.dressCode.text}</p></div>}
      {c.gifts.text && <div className={s.window} data-reveal="up" style={{ "--d": "0.1s" }}><h3 className={s.small}>{c.gifts.title}</h3><p className={s.text}>{c.gifts.text}</p></div>}
    </section>}

    <section id="rsvp" className={s.section}>
      <div className={`${s.window} ${s.rsvp}`} data-reveal="up">
        <h2 className={s.title}>{c.rsvp.title}</h2>
        <p className={s.text}>{c.rsvp.text}</p>
        <Rsvp c={c} submitLabel="Send RSVP" />
      </div>
    </section>

    <section id="pg-closing" className={`${s.section} ${s.closing}`}>
      <div className={s.closingArch} data-reveal="zoom"><ClosingMedia c={c} /></div>
      <h2 className={s.title}>{c.closing.title}</h2>
      <p className={s.date}><span>{first} &amp; {second}</span>{c.hashtag}</p>
    </section>
  </div>;
}

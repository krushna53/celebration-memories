"use client";
import { byDay, cleanTime, photoFor, when, useCountdown, COUNT_UNITS, pad, MapFrame, Rsvp, ClosingMedia } from "./parts";
import s from "./ModernGrid.module.css";

const Marquee = ({ items, className }) => <div className={`${s.marquee} ${className ?? ""}`} aria-hidden="true">
  {[0, 1].map((k) => <div key={k} className={s.track}>{items.map((text, i) => <span key={i}>{text}<i>✺</i></span>)}</div>)}
</div>;

/** A modern, gallery-like grid: oversized date numerals, a moving marquee, numbered sections and clean lines. */
export default function ModernGrid({ c }) {
  const w = when(c);
  const count = useCountdown(c.countdown.date);
  const days = byDay(c.schedule.items);
  const { first, second } = c.couple;
  const strip = [`${first} & ${second}`, `${w.day}.${w.monthNum}.${w.year}`, c.location.name, c.hashtag || "Save the date"];
  let n = 0;
  const head = (label) => <header className={s.head} data-reveal="up"><span>{String(++n).padStart(2, "0")}</span><h2>{label}</h2></header>;
  return <div className={s.grid}>
    <section id="pg-hero" className={s.hero}>
      <div className={s.numerals} aria-label={c.hero.date}>
        <span>{w.day}</span><span>{w.monthNum}</span><span>{w.yy}</span>
      </div>
      <div className={s.heroRight}>
        <figure className={s.photo}><img src={photoFor(c)} alt={`${first} and ${second}`} /></figure>
        <h1 className={s.names}>{first}<small>and</small>{second}</h1>
        <p className={s.meta}>{w.weekday} — {w.time} — {c.location.address}</p>
      </div>
    </section>
    <Marquee items={strip} />

    <section id="pg-welcome" className={s.block}>
      {head("Welcome")}
      <div className={s.split}>
        <p className={s.lede} data-reveal="up">{c.welcome.title.replace(/\n/g, " ")}</p>
        <div data-reveal="up" style={{ "--d": "0.1s" }}>
          {c.welcome.blessing && <p className={s.blessing}>{c.welcome.blessing}</p>}
          {c.welcome.message && <p className={s.body}>{c.welcome.message}</p>}
          {(c.couple.firstParents || c.couple.secondParents) && <p className={s.small}>{[c.couple.firstParents, c.couple.secondParents].filter(Boolean).join(" / ")}</p>}
        </div>
      </div>
    </section>

    <section id="pg-schedule" className={s.block}>
      {head(c.schedule.title)}
      {days.map(({ day, items }, d) => <div key={d} className={s.dayBlock}>
        {day && <h3 className={s.day}>{day}</h3>}
        <ol className={s.rows}>
          {items.map((item, i) => {
            const t = cleanTime(item.time);
            return <li key={i} data-reveal="up" style={{ "--d": `${i * 0.05}s` }}>
              <span className={s.rowTime}>{t.time}</span>
              <span className={s.rowTitle}>{item.title}</span>
              <span className={s.rowPlace}>{item.location || (t.onwards ? "Onwards" : "")}</span>
              <span className={s.arrow} aria-hidden="true">↗</span>
            </li>;
          })}
        </ol>
      </div>)}
    </section>

    <section id="pg-countdown" className={`${s.block} ${s.invert}`}>
      {head(c.countdown.title)}
      <div className={s.count}>
        {COUNT_UNITS.map(([key, label]) => <div key={key} data-reveal="up"><b>{pad(count?.[key])}</b><span>{label}</span></div>)}
      </div>
    </section>

    <section id="pg-venue" className={s.block}>
      {head(c.location.title)}
      <div className={s.split}>
        <figure className={s.venueImg} data-reveal="left"><img src={c.location.image || photoFor(c, 1)} alt={c.location.name} loading="lazy" /></figure>
        <div data-reveal="right">
          <h3 className={s.venueName}>{c.location.name}</h3>
          <p className={s.body}>{c.location.address}</p>
          <MapFrame c={c} className={s.map} />
        </div>
      </div>
    </section>

    {(c.dressCode.text || c.gifts.text) && <section id="pg-details" className={s.block}>
      {head("Good to know")}
      <div className={s.cols}>
        {c.dressCode.text && <article data-reveal="up"><h3>{c.dressCode.title}</h3><p>{c.dressCode.text}</p></article>}
        {c.gifts.text && <article data-reveal="up" style={{ "--d": "0.1s" }}><h3>{c.gifts.title}</h3><p>{c.gifts.text}</p></article>}
      </div>
    </section>}

    <section id="rsvp" className={s.block}>
      {head("RSVP")}
      <div className={s.split}>
        <div data-reveal="up"><p className={s.lede}>{c.rsvp.title}</p><p className={s.body}>{c.rsvp.text}</p></div>
        <div data-reveal="up" style={{ "--d": "0.1s" }}><Rsvp c={c} submitLabel="Send →" /></div>
      </div>
    </section>

    <section id="pg-closing" className={s.closing}>
      <ClosingMedia c={c} className={s.closingMedia} />
      <div className={s.closingText}><p>{c.closing.title}</p></div>
      <Marquee items={[first, "&", second, c.closing.title]} className={s.big} />
    </section>
  </div>;
}

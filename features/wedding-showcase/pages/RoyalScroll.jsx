"use client";
import { byDay, cleanTime, photoFor, closingPhoto, when, useCountdown, COUNT_UNITS, pad, Lines, MapFrame, Rsvp } from "./parts";
import s from "./RoyalScroll.module.css";

/** A ring of petals drawn in SVG, slowly turning behind the names. */
function Mandala({ className }) {
  const petals = (n, r, len, wid) => Array.from({ length: n }, (_, i) => <ellipse key={i} cx="100" cy={100 - r} rx={wid} ry={len} transform={`rotate(${(360 / n) * i} 100 100)`} />);
  return <svg className={className} viewBox="0 0 200 200" aria-hidden="true">
    <g fill="none" stroke="currentColor" strokeWidth="0.6">
      <circle cx="100" cy="100" r="96" /><circle cx="100" cy="100" r="90" strokeDasharray="2 3" />
      {petals(24, 70, 18, 6)}{petals(16, 46, 14, 7)}{petals(8, 24, 12, 8)}
      <circle cx="100" cy="100" r="10" />
    </g>
  </svg>;
}

/** A royal patrika: a parchment scroll that unrolls between wooden rods, marigold toran, diya-lit order of ceremonies. */
export default function RoyalScroll({ c }) {
  const w = when(c);
  const count = useCountdown(c.countdown.date);
  const days = byDay(c.schedule.items);
  const { first, second } = c.couple;
  return <div className={s.wrap}>
    <div className={s.toran} aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ "--i": i, "--h": `${60 + ((i * 37) % 50)}px` }} />)}</div>

    <div className={s.scroll}>
      <div className={s.rod} aria-hidden="true" />
      <div className={s.paper}>
        <section id="pg-names" className={s.hero} data-reveal="unroll">
          <Mandala className={s.mandala} />
          {c.welcome.blessing && <p className={s.blessing}>{c.welcome.blessing}</p>}
          <p className={s.invite}>Together with their families</p>
          <h1 className={s.names}>
            <span>{first}</span>
            <small>weds</small>
            <span>{second}</span>
          </h1>
          {(c.couple.firstParents || c.couple.secondParents) && <div className={s.parents}>
            {c.couple.firstParents && <p>{c.couple.firstParents}</p>}
            {c.couple.secondParents && <p>{c.couple.secondParents}</p>}
          </div>}
          <div className={s.ribbon}><span>{w.weekday}</span><b>{w.day} {w.monthLong} {w.year}</b><span>{w.time}</span></div>
        </section>

        <section id="pg-welcome" className={s.welcome} data-reveal="up">
          <span className={s.ornament} aria-hidden="true">❖ ✿ ❖</span>
          <h2><Lines text={c.welcome.title} /></h2>
          {c.welcome.message && <p>{c.welcome.message}</p>}
        </section>

        <section id="pg-events" className={s.events}>
          <h2 className={s.title} data-reveal="up">{c.schedule.title}</h2>
          {days.map(({ day, items }, d) => <div key={d} className={s.day}>
            {day && <h3 data-reveal="up"><span>{day}</span></h3>}
            <ul>
              {items.map((item, i) => {
                const t = cleanTime(item.time);
                return <li key={i} data-reveal="up" style={{ "--d": `${i * 0.08}s` }}>
                  <span className={s.diya} aria-hidden="true"><i /></span>
                  <span className={s.what}>{item.title}{item.location && <em>{item.location}</em>}</span>
                  <span className={s.when}>{t.time}{t.onwards && <small>onwards</small>}</span>
                </li>;
              })}
            </ul>
          </div>)}
        </section>

        <section id="pg-countdown" className={s.countdown}>
          <h2 className={s.title} data-reveal="up">{c.countdown.title}</h2>
          <div className={s.windows}>
            {COUNT_UNITS.map(([key, label], i) => <div key={key} className={s.window} data-reveal="up" style={{ "--d": `${i * 0.1}s` }}><b>{pad(count?.[key])}</b><span>{label}</span></div>)}
          </div>
        </section>

        <section id="pg-venue" className={s.venue}>
          <h2 className={s.title} data-reveal="up">{c.location.title}</h2>
          <figure className={s.frame} data-reveal="zoom"><img src={c.location.image || photoFor(c, 1)} alt={c.location.name} loading="lazy" /></figure>
          <h3 className={s.venueName}>{c.location.name}</h3>
          <p className={s.address}>{c.location.address}</p>
          <MapFrame c={c} className={s.map} />
        </section>

        {(c.dressCode.text || c.gifts.text) && <section id="pg-notes" className={s.notes}>
          {c.dressCode.text && <article data-reveal="left"><h3>{c.dressCode.title}</h3><p>{c.dressCode.text}</p></article>}
          {c.gifts.text && <article data-reveal="right"><h3>{c.gifts.title}</h3><p>{c.gifts.text}</p></article>}
        </section>}

        <section id="rsvp" className={s.rsvp}>
          <h2 className={s.title} data-reveal="up">{c.rsvp.title}</h2>
          <p className={s.lead}>{c.rsvp.text}</p>
          <Rsvp c={c} submitLabel="Send our blessings" />
        </section>

        <section id="pg-closing" className={s.closing}>
          <div className={s.arch} data-reveal="zoom">{c.closing.video
            ? <video src={c.closing.video} autoPlay muted loop playsInline preload="metadata" />
            : <img src={closingPhoto(c)} alt={`${first} and ${second}`} loading="lazy" />}</div>
          <h2>{c.closing.title}</h2>
          <p className={s.sign}>{first} &amp; {second}</p>
          {c.hashtag && <p className={s.tag}>{c.hashtag}</p>}
        </section>
      </div>
      <div className={`${s.rod} ${s.bottom}`} aria-hidden="true" />
    </div>
  </div>;
}

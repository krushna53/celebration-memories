"use client";
import { byDay, cleanTime, photoFor, when, useCountdown, COUNT_UNITS, pad, Lines, MapFrame, Rsvp, ClosingMedia } from "./parts";
import s from "./Celestial.module.css";

// the same sky every time (no random numbers, so the server and the browser draw the same stars)
const STARS = Array.from({ length: 90 }, (_, i) => ({
  left: (i * 47.3) % 100, top: (i * 29.7 + (i % 7) * 11) % 100, size: 1 + (i % 3), delay: (i % 9) * 0.6,
}));
// a little constellation of two stars meeting
const POINTS = [[20, 70], [34, 40], [50, 58], [66, 34], [80, 66], [50, 86]];

/** Ring that fills with how much of the unit is left. */
function Ring({ value, max, label }) {
  const r = 44, len = 2 * Math.PI * r;
  const part = value === undefined ? 0 : Math.min(1, value / max);
  return <div className={s.ring}>
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r={r} className={s.track} />
      <circle cx="50" cy="50" r={r} className={s.fill} strokeDasharray={len} strokeDashoffset={len * (1 - part)} />
    </svg>
    <b>{pad(value)}</b><span>{label}</span>
  </div>;
}

/** "Written in the stars": a twinkling night sky, a crescent moon, constellation timeline and glass cards. */
export default function Celestial({ c }) {
  const w = when(c);
  const count = useCountdown(c.countdown.date);
  const days = byDay(c.schedule.items);
  const { first, second } = c.couple;
  return <div className={s.night}>
    <div className={s.sky} aria-hidden="true">
      {STARS.map((st, i) => <i key={i} style={{ left: `${st.left}%`, top: `${st.top}%`, width: st.size, height: st.size, animationDelay: `${st.delay}s` }} />)}
      <span className={s.shooting} /><span className={`${s.shooting} ${s.late}`} />
    </div>

    <section id="pg-sky" className={s.hero}>
      <span className={s.moon} aria-hidden="true" />
      <svg className={s.constellation} viewBox="0 0 100 100" aria-hidden="true">
        <polyline points={POINTS.map((pt) => pt.join(",")).join(" ")} />
        {POINTS.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i === 2 || i === 5 ? 1.6 : 1} />)}
      </svg>
      {c.welcome.blessing && <p className={s.blessing}>{c.welcome.blessing}</p>}
      <p className={s.kicker}>Written in the stars</p>
      <h1 className={s.names}><span>{first}</span><small>&amp;</small><span>{second}</span></h1>
      <p className={s.date}>{w.weekday} · {c.hero.date} · {w.time}</p>
    </section>

    <section id="pg-welcome" className={s.section}>
      <div className={s.glass} data-reveal="up">
        <h2 className={s.title}><Lines text={c.welcome.title} /></h2>
        {c.welcome.message && <p className={s.text}>{c.welcome.message}</p>}
        {(c.couple.firstParents || c.couple.secondParents) && <p className={s.parents}>{c.couple.firstParents}{c.couple.firstParents && c.couple.secondParents && <br />}{c.couple.secondParents}</p>}
      </div>
    </section>

    <section id="pg-countdown" className={s.section}>
      <h2 className={s.title} data-reveal="up">{c.countdown.title}</h2>
      <div className={s.rings} data-reveal="zoom">
        {COUNT_UNITS.map(([key, label, max]) => <Ring key={key} value={count?.[key]} max={max} label={label} />)}
      </div>
    </section>

    <section id="pg-timeline" className={s.section}>
      <h2 className={s.title} data-reveal="up">{c.schedule.title}</h2>
      <div className={s.timeline}>
        {days.map(({ day, items }, d) => <div key={d}>
          {day && <h3 className={s.day} data-reveal="up">{day}</h3>}
          {items.map((item, i) => {
            const t = cleanTime(item.time);
            return <article key={i} className={s.event} data-reveal={i % 2 ? "right" : "left"}>
              <span className={s.star} aria-hidden="true">✦</span>
              <div className={s.glass}>
                <p className={s.time}>{t.time}{t.onwards && " onwards"}</p>
                <h4>{item.title}</h4>
                {item.location && <p className={s.place}>{item.location}</p>}
              </div>
            </article>;
          })}
        </div>)}
      </div>
    </section>

    <section id="pg-venue" className={s.section}>
      <div className={`${s.glass} ${s.venue}`} data-reveal="up">
        <img src={c.location.image || photoFor(c, 1)} alt={c.location.name} loading="lazy" />
        <div>
          <p className={s.kicker}>{c.location.title}</p>
          <h2 className={s.venueName}>{c.location.name}</h2>
          <p className={s.text}>{c.location.address}</p>
        </div>
      </div>
      <MapFrame c={c} className={s.map} />
    </section>

    {(c.dressCode.text || c.gifts.text) && <section id="pg-notes" className={`${s.section} ${s.pair}`}>
      {c.dressCode.text && <div className={s.glass} data-reveal="up"><p className={s.kicker}>☾</p><h3 className={s.small}>{c.dressCode.title}</h3><p className={s.text}>{c.dressCode.text}</p></div>}
      {c.gifts.text && <div className={s.glass} data-reveal="up" style={{ "--d": "0.12s" }}><p className={s.kicker}>✧</p><h3 className={s.small}>{c.gifts.title}</h3><p className={s.text}>{c.gifts.text}</p></div>}
    </section>}

    <section id="rsvp" className={s.section}>
      <div className={s.glass} data-reveal="up">
        <h2 className={s.title}>{c.rsvp.title}</h2>
        <p className={s.text}>{c.rsvp.text}</p>
        <Rsvp c={c} tone="dark" submitLabel="Make a wish & reply" />
      </div>
    </section>

    <section id="pg-closing" className={`${s.section} ${s.closing}`}>
      <div className={s.orb} data-reveal="zoom"><ClosingMedia c={c} /></div>
      <h2 className={s.title}>{c.closing.title}</h2>
      <p className={s.date}>{first} &amp; {second}{c.hashtag && <> · {c.hashtag}</>}</p>
    </section>
  </div>;
}

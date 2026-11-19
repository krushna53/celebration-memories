"use client";
import { byDay, cleanTime, photoFor, galleryPhoto, when, useCountdown, COUNT_UNITS, pad, Lines, MapFrame, Rsvp, ClosingMedia } from "./parts";
import s from "./Scrapbook.module.css";

const TILTS = [-3, 2.5, -1.5, 3, -2.5, 1.5];
const NOTE_TINTS = [0, 1, 2, 3];

/** A hand-made scrapbook: taped polaroids, notebook paper, sticky notes for the events and a tear-off calendar. */
export default function Scrapbook({ c }) {
  const w = when(c);
  const count = useCountdown(c.countdown.date);
  const days = byDay(c.schedule.items);
  const { first, second } = c.couple;
  let n = 0;
  return <div className={s.book}>
    <section id="pg-cover" className={s.hero}>
      <div className={s.doodles} aria-hidden="true"><i>♡</i><i>✿</i><i>☆</i><i>♡</i><i>✦</i></div>
      <figure className={s.polaroid} data-reveal="tilt" style={{ "--tilt": "-12deg", "--rest": "-3deg" }}>
        <span className={s.tape} /><span className={`${s.tape} ${s.tape2}`} />
        <img src={photoFor(c)} alt={`${first} and ${second}`} />
        <figcaption>{first} + {second}</figcaption>
      </figure>
      <div className={s.heroText}>
        <span className={s.stamp} aria-hidden="true"><svg viewBox="0 0 120 120"><defs><path id="sb-ring" d="M60 60m-46 0a46 46 0 1 1 92 0a46 46 0 1 1-92 0" /></defs><text><textPath href="#sb-ring">SAVE THE DATE · SAVE THE DATE · </textPath></text></svg><b>{w.day}<small>{w.month}</small></b></span>
        <p className={s.scribble}>we&apos;re getting married!</p>
        <h1 className={s.names}>{first}<span> &amp; </span>{second}</h1>
        <p className={s.date}>{c.hero.date} · {w.time}</p>
        {c.welcome.blessing && <p className={s.blessing}>{c.welcome.blessing}</p>}
      </div>
    </section>

    <section id="pg-note" className={s.noteSection}>
      <article className={s.notebook} data-reveal="up">
        <h2><Lines text={c.welcome.title} /></h2>
        {c.welcome.message && <p>{c.welcome.message}</p>}
        {(c.couple.firstParents || c.couple.secondParents) && <p className={s.parents}>{[c.couple.firstParents, c.couple.secondParents].filter(Boolean).join("  ·  ")}</p>}
        <p className={s.signoff}>— with love, {first} &amp; {second}</p>
      </article>
      <div className={s.strip} aria-hidden="true">
        {[0, 1, 2].map((i) => <figure key={i} className={s.mini} data-reveal="tilt" style={{ "--tilt": `${TILTS[i] * 3}deg`, "--rest": `${TILTS[i]}deg`, "--d": `${i * 0.12}s` }}><img src={galleryPhoto(c, i)} alt="" loading="lazy" /></figure>)}
      </div>
    </section>

    <section id="pg-plans" className={s.plans}>
      <h2 className={s.title} data-reveal="up">{c.schedule.title}</h2>
      {days.map(({ day, items }, d) => <div key={d} className={s.day}>
        {day && <h3 className={s.dayLabel} data-reveal="up">{day}</h3>}
        <div className={s.notes}>
          {items.map((item, i) => {
            const t = cleanTime(item.time);
            const k = n++;
            return <article key={i} className={s.sticky} data-tint={NOTE_TINTS[k % 4]} data-reveal="tilt" style={{ "--tilt": `${TILTS[k % 6] * 3}deg`, "--rest": `${TILTS[k % 6]}deg`, "--d": `${(i % 3) * 0.1}s` }}>
              <span className={s.pin} aria-hidden="true" />
              <p className={s.noteTime}>{t.time}{t.onwards && " onwards"}</p>
              <h4>{item.title}</h4>
              {item.location && <p className={s.notePlace}>@ {item.location}</p>}
            </article>;
          })}
        </div>
      </div>)}
    </section>

    <section id="pg-countdown" className={s.countdown}>
      <h2 className={s.title} data-reveal="up">{c.countdown.title}</h2>
      <div className={s.calendars}>
        {COUNT_UNITS.map(([key, label], i) => <div key={key} className={s.calendar} data-reveal="up" style={{ "--d": `${i * 0.1}s` }}>
          <span className={s.rings} aria-hidden="true" />
          <b key={count?.[key]}>{pad(count?.[key])}</b>
          <span>{label}</span>
        </div>)}
      </div>
    </section>

    <section id="pg-venue" className={s.venue}>
      <article className={s.postcard} data-reveal="tilt" style={{ "--tilt": "6deg", "--rest": "1.5deg" }}>
        <span className={s.tape} />
        <img src={c.location.image || photoFor(c, 5)} alt={c.location.name} loading="lazy" />
        <div>
          <p className={s.scribble}>meet us here →</p>
          <h2>{c.location.name}</h2>
          <p>{c.location.address}</p>
        </div>
      </article>
      <MapFrame c={c} className={s.map} />
    </section>

    {(c.dressCode.text || c.gifts.text) && <section id="pg-cards" className={s.cards}>
      {c.dressCode.text && <article className={s.index} data-reveal="tilt" style={{ "--tilt": "-6deg", "--rest": "-1.5deg" }}><h3>{c.dressCode.title}</h3><p>{c.dressCode.text}</p></article>}
      {c.gifts.text && <article className={s.index} data-reveal="tilt" style={{ "--tilt": "6deg", "--rest": "1.5deg" }}><h3>{c.gifts.title}</h3><p>{c.gifts.text}</p></article>}
    </section>}

    <section id="rsvp" className={s.rsvp}>
      <article className={s.notebook} data-reveal="up">
        <span className={s.tape} />
        <h2>{c.rsvp.title}</h2>
        <p>{c.rsvp.text}</p>
        <Rsvp c={c} submitLabel="Count me in ♡" />
      </article>
    </section>

    <section id="pg-closing" className={s.closing}>
      <figure className={s.polaroid} data-reveal="tilt" style={{ "--tilt": "10deg", "--rest": "2deg" }}>
        <span className={s.tape} />
        <ClosingMedia c={c} />
        <figcaption>{c.closing.title}</figcaption>
      </figure>
      <p className={s.xoxo}>xoxo, {first} &amp; {second}</p>
      {c.hashtag && <p className={s.date}>{c.hashtag}</p>}
    </section>
  </div>;
}

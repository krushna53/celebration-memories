"use client";
import { byDay, cleanTime, photoFor, when, useCountdown, COUNT_UNITS, pad, Lines, Barcode, MapFrame, Rsvp, ClosingMedia } from "./parts";
import s from "./Editorial.module.css";

/** "The Wedding Issue": the invitation as a glossy magazine — cover, editor's letter, contents, feature story, back cover. */
export default function Editorial({ c }) {
  const w = when(c);
  const count = useCountdown(c.countdown.date);
  const days = byDay(c.schedule.items);
  const { first, second } = c.couple;
  let page = 2;
  return <div className={s.mag}>
    <section id="pg-cover" className={s.cover}>
      <header className={s.mast}>
        <span>Vol. {w.yy} · No. {w.day}</span>
        <h1 className={s.wordmark} aria-label="Forever">{"FOREVER".split("").map((ch, i) => <i key={i} style={{ "--i": i }}>{ch}</i>)}</h1>
        <span>The wedding issue · {w.monthLong} {w.year}</span>
      </header>
      <figure className={s.coverPhoto}>
        <img src={photoFor(c)} alt={`${first} and ${second}`} />
        <figcaption className={s.coverNames}>
          <span className={s.exclusive}>Exclusive</span>
          <span className={s.nameA}>{first}</span>
          <span className={s.amp}>&amp;</span>
          <span className={s.nameB}>{second}</span>
        </figcaption>
      </figure>
      <ul className={s.coverLines}>
        <li><b>Save the date</b>{c.hero.date}</li>
        <li><b>Inside</b>The full schedule, p.{page + 1}</li>
        <li><b>Where it happens</b>{c.location.name}</li>
        <li><b>Your reply</b>RSVP card, last page</li>
      </ul>
      <div className={s.coverFoot}><Barcode text={first + second} /><span>{c.hashtag || "Priceless · collector's edition"}</span></div>
    </section>

    <section id="pg-letter" className={s.letter}>
      <p className={s.folio}>p.{page} — Editor&apos;s letter</p>
      {c.welcome.blessing && <p className={s.blessing} data-reveal="up">{c.welcome.blessing}</p>}
      <h2 className={s.headline} data-reveal="up"><Lines text={c.welcome.title} /></h2>
      <div className={s.columns} data-reveal="up" style={{ "--d": "0.15s" }}>
        <p className={s.drop}>{c.welcome.message || `With joy in our hearts, our families invite you to celebrate the wedding of ${first} and ${second}.`}</p>
        {(c.couple.firstParents || c.couple.secondParents) && <p className={s.parents}>
          {c.couple.firstParents && <span><b>{first}</b> {c.couple.firstParents}</span>}
          {c.couple.secondParents && <span><b>{second}</b> {c.couple.secondParents}</span>}
        </p>}
      </div>
      <p className={s.pull} data-reveal="zoom">“Two families, one celebration — and a seat saved just for you.”</p>
    </section>

    <section id="pg-contents" className={s.contents}>
      <p className={s.folio}>p.{++page} — Contents</p>
      <h2 className={s.sectionTitle} data-reveal="up">In this issue</h2>
      {days.map(({ day, items }, d) => <div key={d} className={s.day} data-reveal="up">
        {day && <h3>{day}</h3>}
        <ol>
          {items.map((item, i) => {
            const t = cleanTime(item.time);
            return <li key={i}>
              <span className={s.event}>{item.title}{item.location && <em>{item.location}</em>}</span>
              <span className={s.leader} aria-hidden="true" />
              <span className={s.time}>{t.time}{t.onwards && <small> onwards</small>}</span>
            </li>;
          })}
        </ol>
      </div>)}
    </section>

    <section id="pg-countdown" className={s.countdown}>
      <p className={s.kicker}>{c.countdown.title}</p>
      <div className={s.bigNums}>
        {COUNT_UNITS.map(([key, label]) => <div key={key} data-reveal="up"><b>{pad(count?.[key])}</b><span>{label}</span></div>)}
      </div>
    </section>

    <section id="pg-feature" className={s.feature}>
      <p className={s.folio}>p.{++page} — The feature</p>
      <div className={s.featureGrid}>
        <figure data-reveal="left"><img src={c.location.image || photoFor(c, 1)} alt={c.location.name} loading="lazy" /><figcaption>The venue, photographed for this issue.</figcaption></figure>
        <div data-reveal="right">
          <p className={s.kicker}>The destination</p>
          <h2 className={s.featureTitle}>{c.location.name}</h2>
          <p className={s.address}>{c.location.address}</p>
          <p className={s.body}>{w.weekday}, {w.day} {w.monthLong} — the ceremony begins at {w.time}. Arrive a little early: the best seats go to those who come first.</p>
        </div>
      </div>
      <MapFrame c={c} className={s.map} />
    </section>

    {(c.dressCode.text || c.gifts.text) && <section id="pg-style" className={s.style}>
      {c.dressCode.text && <article data-reveal="up"><p className={s.kicker}>The style edit</p><h3>{c.dressCode.title}</h3><p>{c.dressCode.text}</p></article>}
      {c.gifts.text && <article data-reveal="up" style={{ "--d": "0.12s" }}><p className={s.kicker}>A note on gifts</p><h3>{c.gifts.title}</h3><p>{c.gifts.text}</p></article>}
    </section>}

    <section id="rsvp" className={s.reply}>
      <div className={s.replyCard} data-reveal="zoom">
        <p className={s.kicker}>Reply card · postage paid</p>
        <h2 className={s.sectionTitle}>{c.rsvp.title}</h2>
        <p className={s.body}>{c.rsvp.text}</p>
        <Rsvp c={c} submitLabel="Post my reply" />
      </div>
    </section>

    <section id="pg-back" className={s.back}>
      <ClosingMedia c={c} className={s.backMedia} />
      <div className={s.backText}>
        <p className={s.kicker}>Back cover</p>
        <h2 data-reveal="up">{c.closing.title}</h2>
        <p className={s.backNames}>{first} &amp; {second}</p>
        {c.hashtag && <p className={s.hashtag}>{c.hashtag}</p>}
      </div>
    </section>
  </div>;
}

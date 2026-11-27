"use client";

import { byDay, cleanTime, when, useCountdown, COUNT_UNITS, pad, photoFor, MapFrame, Rsvp, ClosingMedia } from "./parts";
import s from "./SheeshMahalPage.module.css";

export default function SheeshMahalPage({ c }) {
  const wedding = when(c);
  const countdown = useCountdown(c.countdown.date);
  const days = byDay(c.schedule.items);
  const events = days.flatMap((day) => day.items.map((item) => ({ ...item, day: day.day })));

  return <main className={s.page}>
    <header className={s.invitation}>
      <div className={s.palaceImage}><img src={photoFor(c)} alt={`${c.couple.first} and ${c.couple.second} at their celebration`} /><span className={s.imageGlow} /><span className={s.photoCaption}>A celebration at {c.location.name}</span></div>
      <article className={s.inviteCard}>
        <span className={s.corner} aria-hidden="true">❧</span><span className={`${s.corner} ${s.cornerRight}`} aria-hidden="true">❧</span>
        <p className={s.blessing}>{c.welcome.blessing || "With the blessings of our families"}</p>
        {(c.couple.firstParents || c.couple.secondParents) && <div className={s.parents}>{c.couple.firstParents && <p>{c.couple.firstParents}</p>}{c.couple.secondParents && <p>{c.couple.secondParents}</p>}</div>}
        <p className={s.request}>request the honour of your presence<br />at the wedding celebration of</p>
        <span className={s.ornament} aria-hidden="true">✧ ❧ ✧</span>
        <h1><span>{c.couple.first}</span><i>&amp;</i><span>{c.couple.second}</span></h1>
        <p className={s.date}>{wedding.weekday}, {wedding.day} {wedding.monthLong} {wedding.year}<br /><span>{wedding.time}</span></p>
        <p className={s.venueName}>{c.location.name}</p><p className={s.address}>{c.location.address}</p>
        <a className={s.discover} href="#celebrations">Discover the celebrations <span>⌄</span></a>
      </article>
    </header>

    <section className={s.baraat}>
      <img src={photoFor(c, 1)} alt="A moment from the couple's wedding" loading="lazy" />
      <div><p className={s.eyebrow}>The wedding story</p><h2>{c.welcome.title || "Here comes the celebration"}</h2><p>{c.welcome.message}</p></div>
    </section>

    <section className={s.celebrations} id="celebrations">
      <p className={s.eyebrow}>The celebrations</p><h2>{c.schedule.title || "A week of beautiful moments"}</h2>
      <div className={s.eventGrid}>{events.map((item, index) => { const time = cleanTime(item.time); return <article className={s.eventWindow} key={`${item.title}-${index}`}>
        <span className={s.eventNumber}>{String(index + 1).padStart(2, "0")}</span><p className={s.eventDay}>{item.day || wedding.weekday}</p><h3>{item.title}</h3><p className={s.eventTime}>{time.time}{time.onwards ? " onwards" : ""}</p>{item.location && <small>{item.location}</small>}
      </article>; })}</div>
    </section>

    <section className={s.venue}>
      <div className={s.venueCopy}><p className={s.eyebrow}>Find your way to the palace</p><h2>{c.location.name}</h2><p>{c.location.address}</p></div>
      <MapFrame c={c} className={s.map} />
    </section>

    {(c.hashtag || c.dressCode.text || c.gifts.text) && <section className={s.details}><p className={s.eyebrow}>Things to know</p><div>{c.hashtag && <article><h3>Hashtag</h3><p>Tag your photographs with {c.hashtag}</p></article>}{c.dressCode.text && <article><h3>{c.dressCode.title}</h3><p>{c.dressCode.text}</p></article>}{c.gifts.text && <article><h3>{c.gifts.title}</h3><p>{c.gifts.text}</p></article>}</div></section>}

    <section className={s.rsvp}><p className={s.eyebrow}>We hope you can join us</p><h2>Will you be there?</h2><Rsvp c={c} className={s.reply} submitLabel="Send our reply" /></section>

    <footer className={s.closing}>
      <div className={s.closingPhoto}><ClosingMedia c={c} /></div>
      <p className={s.eyebrow}>Until the shehnai plays</p><div className={s.countGrid}>{COUNT_UNITS.map(([key, label]) => <div key={key}><b>{pad(countdown?.[key])}</b><span>{label}</span></div>)}</div>
      <h2>{c.couple.first} <i>&amp;</i> {c.couple.second}</h2>{c.hashtag && <small>{c.hashtag}</small>}
    </footer>
  </main>;
}

"use client";

import { byDay, cleanTime, when, useCountdown, COUNT_UNITS, pad, photoFor, MapFrame, Rsvp, ClosingMedia } from "./parts";
import s from "./FloralInvitation.module.css";

const cx = (...names) => names.filter(Boolean).join(" ");

function Flourish({ className }) {
  return <span aria-hidden="true" className={cx(s.flourish, className)}>❧ <i>✿</i> ❧</span>;
}

function PaperPanel({ children, className, id }) {
  return <section id={id} className={cx(s.panel, className)} data-reveal="up"><div className={s.panelInner}>{children}</div></section>;
}

export default function FloralInvitation({ c, active = false }) {
  const wedding = when(c);
  const countdown = useCountdown(c.countdown.date);
  const days = byDay(c.schedule.items);

  return <main className={s.invitation}>
    <div className={s.paperBook}>
      <section id="pg-hero" className={cx(s.panel, s.cover)}>
        <div className={s.panelInner}>
          {c.welcome.blessing && <p className={s.blessing}>{c.welcome.blessing}</p>}
          <p className={s.eyebrow}>Welcome</p>
          <figure className={`${s.coverPhoto} ${active ? s.coverPhotoOpened : ""}`}><img src={photoFor(c, 0)} alt={`${c.couple.first} and ${c.couple.second}`} /><span aria-hidden="true">❧</span></figure>
          <Flourish />
          <h1>{c.couple.first}<span>&amp;</span>{c.couple.second}</h1>
          <p className={s.coverDate}>{wedding.weekday}, {wedding.day} {wedding.monthLong} {wedding.year}</p>
          <p className={s.coverPlace}>{c.location.name}</p>
          <a href="#pg-note" className={s.scrollCue}>Scroll to explore <span>⌄</span></a>
        </div>
      </section>

      <PaperPanel id="pg-note" className={s.note}>
        <p className={s.eyebrow}>You are invited</p><Flourish />
        <h2>{c.welcome.title || "A day made sweeter with you"}</h2>
        <p className={s.body}>{c.welcome.message || `Together with our families, we invite you to celebrate ${c.couple.first} and ${c.couple.second}.`}</p>
        {(c.couple.firstParents || c.couple.secondParents) && <div className={s.families}>{c.couple.firstParents && <p>{c.couple.firstParents}</p>}{c.couple.secondParents && <p>{c.couple.secondParents}</p>}</div>}
        <p className={s.dateLine}>{wedding.day} · {wedding.monthLong} {wedding.year} · {wedding.time}</p>
      </PaperPanel>

      <PaperPanel id="pg-countdown" className={s.countdown}>
        <p className={s.eyebrow}>{c.countdown.title || "Counting down"}</p><Flourish />
        <div className={s.countGrid}>{COUNT_UNITS.map(([key, label]) => <div key={key}><b>{pad(countdown?.[key])}</b><span>{label}</span></div>)}</div>
      </PaperPanel>

      <PaperPanel id="pg-story" className={s.story}>
        <p className={s.eyebrow}>A little about our day</p>
        <h2>{c.couple.first} &amp; {c.couple.second}</h2>
        <div className={s.storyImage}><img src={photoFor(c, 1)} alt="A moment from the couple's celebration" loading="lazy" /></div>
        <p className={s.body}>{c.welcome.message || `We would be delighted to celebrate this new chapter with you. Your presence will make our day even more special.`}</p>
      </PaperPanel>

      <PaperPanel id="pg-schedule" className={s.schedule}>
        <p className={s.eyebrow}>The celebrations</p><h2>{c.schedule.title || "Wedding schedule"}</h2><Flourish />
        {days.map((day, index) => <div className={s.day} key={`${day.day}-${index}`}>
          {day.day && <h3>{day.day}</h3>}
          <ol>{day.items.map((item, itemIndex) => {
            const time = cleanTime(item.time);
            return <li key={`${item.title}-${itemIndex}`}><span className={s.time}>{time.time}{time.onwards && <small> onwards</small>}</span><span className={s.event}>{item.title}{item.location && <small>{item.location}</small>}</span></li>;
          })}</ol>
        </div>)}
      </PaperPanel>

      <PaperPanel id="pg-venue" className={s.venue}>
        <p className={s.eyebrow}>{c.location.title || "The venue"}</p><h2>{c.location.name}</h2>
        <p className={s.body}>{c.location.address}</p>
        <MapFrame c={c} className={s.map} />
      </PaperPanel>

      {(c.dressCode.text || c.gifts.text) && <PaperPanel id="pg-details" className={s.details}>
        <p className={s.eyebrow}>A few thoughtful details</p>
        {c.dressCode.text && <article><h2>{c.dressCode.title}</h2><p className={s.body}>{c.dressCode.text}</p></article>}
        {c.gifts.text && <article><h2>{c.gifts.title}</h2><p className={s.body}>{c.gifts.text}</p></article>}
      </PaperPanel>}

      <PaperPanel id="pg-rsvp" className={s.rsvp}>
        <p className={s.eyebrow}>Please join us</p><Flourish /><h2>Will you be there?</h2>
        <Rsvp c={c} submitLabel="Send our reply" />
      </PaperPanel>

      <section id="pg-closing" className={cx(s.panel, s.closing)}>
        <div className={s.panelInner}><div className={s.closingImage}><ClosingMedia c={c} /></div><Flourish />
          <h2>{c.closing.title}</h2><p className={s.names}>{c.couple.first} &amp; {c.couple.second}</p>{c.hashtag && <p className={s.hashtag}>{c.hashtag}</p>}
        </div>
      </section>
    </div>
  </main>;
}

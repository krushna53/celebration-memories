"use client";
import { useState } from "react";
import { byDay, cleanTime, photoFor, galleryPhoto, when, useCountdown, COUNT_UNITS, pad, Lines, MapFrame, Rsvp, ClosingMedia } from "./parts";
import k from "./Kit.module.css";

/*
 * Thirteen page designs built from one kit of section styles. Each design picks its own hero, story, schedule,
 * countdown, venue and closing styles (DESIGNS) and has its own colours, patterns and ornaments (Kit.module.css,
 * one class per design), so no two read alike:
 *  hero      — crest, filmstrip, wreath, full, stacked, newspaper, window, split
 *  schedule  — cards, carousel, zigzag, ledger, tabs, icons
 *  countdown — boxes, circle, inline · venue — overlay, split, card · closing — circle, full, plain
 */
export const DESIGNS = {
  luxe: { hero: "crest", story: "centered", schedule: "cards", count: "circle", venue: "overlay", closing: "circle" },
  filmstrip: { hero: "filmstrip", story: "split", schedule: "carousel", count: "boxes", venue: "split", closing: "full" },
  watercolor: { hero: "wreath", story: "centered", schedule: "zigzag", count: "boxes", venue: "card", closing: "circle" },
  sunset: { hero: "full", story: "centered", schedule: "zigzag", count: "inline", venue: "overlay", closing: "full" },
  minimal: { hero: "stacked", story: "split", schedule: "ledger", count: "inline", venue: "split", closing: "plain" },
  newspaper: { hero: "newspaper", story: "columns", schedule: "ledger", count: "boxes", venue: "split", closing: "plain" },
  azulejo: { hero: "window", story: "centered", schedule: "carousel", count: "circle", venue: "card", closing: "circle" },
  deco: { hero: "crest", story: "centered", schedule: "tabs", count: "boxes", venue: "overlay", closing: "full" },
  kasavu: { hero: "split", story: "centered", schedule: "ledger", count: "boxes", venue: "card", closing: "circle" },
  alpona: { hero: "wreath", story: "centered", schedule: "icons", count: "circle", venue: "split", closing: "circle" },
  paisley: { hero: "window", story: "split", schedule: "icons", count: "boxes", venue: "overlay", closing: "full" },
  pearl: { hero: "split", story: "centered", schedule: "cards", count: "inline", venue: "card", closing: "circle" },
  phulkari: { hero: "stacked", story: "centered", schedule: "tabs", count: "boxes", venue: "overlay", closing: "full" },
};

const cx = (...names) => names.filter(Boolean).join(" ");
const range = (n) => Array.from({ length: n }, (_, i) => i);

/** A little picture for an event, from its name. */
const ICONS = [[/haldi|pithi|gaye holud/i, "🌼"], [/mehe?n?di|manjha/i, "🌿"], [/sangeet|garba|dandiya|cocktail|dance|dj/i, "🎶"],
  [/baraat|bor jatri|jaan/i, "🐎"], [/phera|mandap|muhurtham|biye|anand karaj|vivah|hast melap|varmala/i, "🔥"], [/nikah/i, "🌙"],
  [/reception|walima|bou bhaat|dinner|lunch|bhojan/i, "🥂"], [/matrimony|ceremony|vows/i, "💍"], [/kirtan|path|puja|ganesh/i, "🪔"]];
const iconFor = (title) => ICONS.find(([re]) => re.test(title))?.[1] ?? "✦";

/** Section heading with the design's own ornament (drawn in CSS). */
const Head = ({ kicker, children }) => <header className={k.head} data-reveal="up">
  {kicker && <p className={k.kicker}>{kicker}</p>}
  <h2 className={k.title}>{children}</h2>
  <span className={k.ornament} aria-hidden="true" />
</header>;

/** A ring of leaves and buds around the names (watercolour, alpona). */
function Wreath() {
  return <svg className={k.wreath} viewBox="0 0 200 200" aria-hidden="true">
    {range(28).map((i) => {
      const a = (i / 28) * 360;
      return <g key={i} transform={`rotate(${a} 100 100)`}>
        <ellipse className={i % 3 ? k.leaf : k.leaf2} cx="100" cy="14" rx="5" ry="11" transform={`rotate(${i % 2 ? 28 : -28} 100 14)`} />
        {i % 4 === 0 && <circle className={k.bud} cx="100" cy="10" r="5" />}
      </g>;
    })}
  </svg>;
}

/** Laurel and monogram crest (luxe, deco). */
function Crest({ monogram }) {
  return <div className={k.crest} aria-hidden="true">
    <svg viewBox="0 0 200 200">
      <circle cx="100" cy="100" r="78" className={k.crestRing} />
      <circle cx="100" cy="100" r="70" className={k.crestRing2} />
      {range(9).map((i) => <ellipse key={`l${i}`} className={k.laurel} cx={40 + i * 2} cy={150 - i * 12} rx="5" ry="11" transform={`rotate(${-50 + i * 6} ${40 + i * 2} ${150 - i * 12})`} />)}
      {range(9).map((i) => <ellipse key={`r${i}`} className={k.laurel} cx={160 - i * 2} cy={150 - i * 12} rx="5" ry="11" transform={`rotate(${50 - i * 6} ${160 - i * 2} ${150 - i * 12})`} />)}
    </svg>
    <b>{monogram.replace(/\s/g, "")}</b>
  </div>;
}

function Hero({ type, c, w }) {
  const { first, second } = c.couple;
  const names = <h1 className={k.names}><span>{first}</span><em>&amp;</em><span>{second}</span></h1>;
  const meta = <p className={k.meta}>{w.weekday} · {c.hero.date} · {w.time}</p>;
  const blessing = c.welcome.blessing && <p className={k.blessing}>{c.welcome.blessing}</p>;
  const photo = <img src={photoFor(c)} alt={`${first} and ${second}`} />;
  switch (type) {
    case "crest": return <section id="pg-hero" className={cx(k.hero, k.heroCrest)}>
      {blessing}<Crest monogram={c.monogram} /><p className={k.kicker}>The wedding of</p>{names}{meta}
    </section>;
    case "filmstrip": return <section id="pg-hero" className={cx(k.hero, k.heroFilm)}>
      <div className={k.strip}>{[0, 1, 2, 3].map((i) => <figure key={i}><img src={galleryPhoto(c, i)} alt="" /></figure>)}</div>
      <p className={k.kicker}>A love story · in cinemas {w.day} {w.month}</p>{names}{meta}
      <div className={k.tickets}><span>Admit one</span><span>Row A · Seat ♥</span></div>
    </section>;
    case "wreath": return <section id="pg-hero" className={cx(k.hero, k.heroWreath)}>
      {blessing}<div className={k.ring}><Wreath /><div className={k.ringText}><p className={k.kicker}>Together with their families</p>{names}</div></div>{meta}
    </section>;
    case "full": return <section id="pg-hero" className={cx(k.hero, k.heroFull)}>
      <div className={k.fullPhoto}>{photo}</div><span className={k.sun} aria-hidden="true" />
      <div className={k.fullText}>{blessing}<p className={k.kicker}>Save the date</p>{names}{meta}</div>
    </section>;
    case "stacked": return <section id="pg-hero" className={cx(k.hero, k.heroStacked)}>
      {blessing}<p className={k.kicker}>{w.day} · {w.monthLong} · {w.year}</p>
      <h1 className={k.stack}><span>{first}</span><span className={k.cut}>{photo}</span><span>{second}</span></h1>{meta}
    </section>;
    case "newspaper": return <section id="pg-hero" className={cx(k.hero, k.heroNews)}>
      <div className={k.mast}><span>Vol. {w.yy} · No. {w.day}</span><b>The Daily Vows</b><span>{w.weekday}, {w.day} {w.monthLong} {w.year} · Price: your presence</span></div>
      <p className={k.headline}>{first} &amp; {second} to wed</p>
      <p className={k.dek}>Families delighted; guests advised to clear their calendars for {c.hero.date}. Full story below.</p>
      <figure className={k.newsPhoto}>{photo}<figcaption>The couple, photographed ahead of the big day.</figcaption></figure>
    </section>;
    case "window": return <section id="pg-hero" className={cx(k.hero, k.heroWindow)}>
      <div className={k.awning} aria-hidden="true" />{blessing}
      <div className={k.frame}>{photo}</div><p className={k.kicker}>You are invited</p>{names}{meta}
    </section>;
    default: return <section id="pg-hero" className={cx(k.hero, k.heroSplit)}>
      <div className={k.splitPhoto} data-reveal="left">{photo}</div>
      <div className={k.splitText}>{blessing}<p className={k.kicker}>The wedding of</p>{names}{meta}</div>
    </section>;
  }
}

function Story({ type, c }) {
  const { first, second, firstParents, secondParents } = c.couple;
  const parents = (firstParents || secondParents) && <div className={k.parents}>
    {firstParents && <p><b>{first}</b>{firstParents}</p>}
    {secondParents && <p><b>{second}</b>{secondParents}</p>}
  </div>;
  const message = c.welcome.message || `With joy in our hearts, our families invite you to celebrate the wedding of ${first} and ${second}.`;
  return <section id="pg-story" className={cx(k.section, k[`story_${type}`])}>
    <Head kicker="A note from us"><Lines text={c.welcome.title} /></Head>
    <div className={k.storyBody} data-reveal="up"><p className={k.text}>{message}</p>{parents}</div>
  </section>;
}

function Schedule({ type, c }) {
  const days = byDay(c.schedule.items);
  const [tab, setTab] = useState(0);
  const event = (item, i, extra) => {
    const t = cleanTime(item.time);
    return <article key={i} className={k.event} data-reveal="up" style={{ "--d": `${(i % 4) * 0.08}s` }} {...extra}>
      {type === "icons" && <span className={k.icon} aria-hidden="true">{iconFor(item.title)}</span>}
      <p className={k.time}>{t.time}{t.onwards && <small> onwards</small>}</p>
      <h3 className={k.what}>{item.title}</h3>
      {item.location && <p className={k.where}>{item.location}</p>}
    </article>;
  };
  if (type === "tabs" && days.length > 1) return <section id="pg-schedule" className={cx(k.section, k.sched_tabs)}>
    <Head kicker="The celebrations">{c.schedule.title}</Head>
    <div className={k.tabs} role="tablist">{days.map((d, i) => <button key={i} type="button" role="tab" aria-selected={tab === i} className={tab === i ? k.tabOn : k.tab} onClick={() => setTab(i)}>{d.day || `Day ${i + 1}`}</button>)}</div>
    <div className={k.events} role="tabpanel" key={tab}>{days[tab]?.items.map((item, i) => event(item, i))}</div>
  </section>;
  if (type === "ledger") return <section id="pg-schedule" className={cx(k.section, k.sched_ledger)}>
    <Head kicker="Order of events">{c.schedule.title}</Head>
    {days.map((d, di) => <div key={di} className={k.dayBlock}>
      {d.day && <h3 className={k.day}>{d.day}</h3>}
      <ol className={k.ledger}>{d.items.map((item, i) => {
        const t = cleanTime(item.time);
        return <li key={i} data-reveal="up"><span className={k.time}>{t.time}</span><span className={k.what}>{item.title}</span><span className={k.where}>{item.location || (t.onwards ? "onwards" : "")}</span></li>;
      })}</ol>
    </div>)}
  </section>;
  return <section id="pg-schedule" className={cx(k.section, k[`sched_${type === "tabs" ? "cards" : type}`])}>
    <Head kicker="The celebrations">{c.schedule.title}</Head>
    {days.map((d, di) => <div key={di} className={k.dayBlock}>
      {d.day && <h3 className={k.day} data-reveal="up">{d.day}</h3>}
      <div className={k.events}>{d.items.map((item, i) => event(item, i))}</div>
    </div>)}
  </section>;
}

function Countdown({ type, c }) {
  const count = useCountdown(c.countdown.date);
  if (type === "inline") return <section id="pg-countdown" className={cx(k.section, k.count_inline)}>
    <p className={k.sentence} data-reveal="up">Only <b>{count?.days ?? "—"}</b> days, <b>{pad(count?.hours)}</b> hours and <b>{pad(count?.minutes)}</b> minutes until we say yes — <b className={k.secs}>{pad(count?.seconds)}</b></p>
  </section>;
  if (type === "circle") {
    const r = 46, len = 2 * Math.PI * r, part = count ? Math.min(1, count.days / 365) : 0;
    return <section id="pg-countdown" className={cx(k.section, k.count_circle)}>
      <Head kicker="Counting down">{c.countdown.title}</Head>
      <div className={k.dial} data-reveal="zoom">
        <svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r={r} className={k.dialTrack} /><circle cx="50" cy="50" r={r} className={k.dialFill} strokeDasharray={len} strokeDashoffset={len * (1 - part)} /></svg>
        <b>{count?.days ?? "—"}</b><span>days to go</span>
        <small>{pad(count?.hours)} : {pad(count?.minutes)} : {pad(count?.seconds)}</small>
      </div>
    </section>;
  }
  return <section id="pg-countdown" className={cx(k.section, k.count_boxes)}>
    <Head kicker="Counting down">{c.countdown.title}</Head>
    <div className={k.boxes}>{COUNT_UNITS.map(([key, label], i) => <div key={key} data-reveal="up" style={{ "--d": `${i * 0.08}s` }}><b>{pad(count?.[key])}</b><span>{label}</span></div>)}</div>
  </section>;
}

function Venue({ type, c }) {
  const image = c.location.image || photoFor(c, 1);
  const text = <div className={k.venueText}>
    <p className={k.kicker}>{c.location.title}</p>
    <h2 className={k.venueName}>{c.location.name}</h2>
    <p className={k.text}>{c.location.address}</p>
  </div>;
  return <section id="pg-venue" className={cx(k.section, k[`venue_${type}`])}>
    {type === "overlay"
      ? <div className={k.venueOverlay} style={{ backgroundImage: `url("${image}")` }}><div data-reveal="up">{text}</div></div>
      : <div className={k.venueGrid}><img className={k.venueImg} src={image} alt={c.location.name} loading="lazy" data-reveal={type === "split" ? "left" : "zoom"} />{text}</div>}
    <MapFrame c={c} className={k.map} />
  </section>;
}

function Details({ c }) {
  if (!c.dressCode.text && !c.gifts.text) return null;
  return <section id="pg-details" className={cx(k.section, k.details)}>
    {c.dressCode.text && <article className={k.note} data-reveal="up"><h3>{c.dressCode.title}</h3><p>{c.dressCode.text}</p></article>}
    {c.gifts.text && <article className={k.note} data-reveal="up" style={{ "--d": "0.1s" }}><h3>{c.gifts.title}</h3><p>{c.gifts.text}</p></article>}
  </section>;
}

function Closing({ type, c }) {
  return <section id="pg-closing" className={cx(k.closing, k[`close_${type}`])}>
    {type !== "plain" && <div className={k.closeMedia} data-reveal="zoom"><ClosingMedia c={c} /></div>}
    <div className={k.closeText}>
      <h2 className={k.closeTitle}>{c.closing.title}</h2>
      <p className={k.closeNames}>{c.couple.first} &amp; {c.couple.second}</p>
      {c.hashtag && <p className={k.hashtag}>{c.hashtag}</p>}
    </div>
  </section>;
}

/** One of the kit designs. design: a key of DESIGNS. */
export default function Kit({ c, design }) {
  const d = DESIGNS[design] ?? DESIGNS.pearl;
  const w = when(c);
  return <div className={cx(k.kit, k[design])}>
    <Hero type={d.hero} c={c} w={w} />
    <Story type={d.story} c={c} />
    <Countdown type={d.count} c={c} />
    <Schedule type={d.schedule} c={c} />
    <Venue type={d.venue} c={c} />
    <Details c={c} />
    <section id="rsvp" className={cx(k.section, k.rsvpSec)}>
      <div className={k.rsvpCard} data-reveal="up">
        <Head kicker="Kindly reply">{c.rsvp.title}</Head>
        <p className={k.text}>{c.rsvp.text}</p>
        <Rsvp c={c} tone={["luxe", "deco", "filmstrip", "alpona"].includes(design) ? "dark" : "light"} />
      </div>
    </section>
    <Closing type={d.closing} c={c} />
  </div>;
}

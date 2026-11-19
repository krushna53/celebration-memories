"use client";
import { byDay, cleanTime, photoFor, when, useCountdown, COUNT_UNITS, pad, Barcode, MapFrame, Rsvp, ClosingMedia } from "./parts";
import s from "./BoardingPass.module.css";

const code = (name = "") => name.normalize("NFKD").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase().padEnd(3, "X");

/** Split-flap characters: each one flips when it changes. */
const Flaps = ({ text }) => <span className={s.flaps}>{String(text).split("").map((ch, i) => <span key={`${i}-${ch}`} className={s.flap}>{ch}</span>)}</span>;

/** "Flight to Forever": a boarding pass, a departures board for the schedule, a destination postcard and check-in. */
export default function BoardingPass({ c }) {
  const w = when(c);
  const count = useCountdown(c.countdown.date);
  const days = byDay(c.schedule.items);
  const { first, second } = c.couple;
  const flight = `FE ${w.day}${w.monthNum}`;
  let row = 0;
  return <div className={s.trip}>
    <section id="pg-pass" className={s.hero}>
      <p className={s.airline}>✈ Forever Airways · Wedding Class</p>
      <article className={s.pass} data-reveal="up">
        <div className={s.main}>
          <div className={s.route}>
            <div><span className={s.code}>{code(first)}</span><span className={s.city}>{first}</span></div>
            <div className={s.flight} aria-hidden="true"><i className={s.plane}>✈</i></div>
            <div><span className={s.code}>{code(second)}</span><span className={s.city}>{second}</span></div>
          </div>
          <dl className={s.fields}>
            <div><dt>Passenger</dt><dd>Our dear guest</dd></div>
            <div><dt>Flight</dt><dd>{flight}</dd></div>
            <div><dt>Date</dt><dd>{w.day} {w.month} {w.year}</dd></div>
            <div><dt>Boarding</dt><dd>{w.time}</dd></div>
            <div><dt>Gate</dt><dd>Love</dd></div>
            <div><dt>Seat</dt><dd>Front row</dd></div>
          </dl>
          <p className={s.dest}>Destination <b>{c.location.name}</b></p>
        </div>
        <div className={s.stub}>
          <p className={s.stubTitle}>Boarding pass</p>
          <p className={s.stubNames}>{first} <span>&amp;</span> {second}</p>
          <p className={s.stubDate}>{c.hero.date}</p>
          <Barcode text={first + second} className={s.bars} />
        </div>
      </article>
      {c.welcome.blessing && <p className={s.blessing}>{c.welcome.blessing}</p>}
    </section>

    <section id="pg-announce" className={s.announce} data-reveal="up">
      <span className={s.speaker} aria-hidden="true">🔊</span>
      <div>
        <p className={s.label}>Announcement from the captains</p>
        <h2>{c.welcome.title.replace(/\n/g, " · ")}</h2>
        {c.welcome.message && <p>{c.welcome.message}</p>}
      </div>
    </section>

    <section id="pg-board" className={s.board}>
      <div className={s.boardHead}><span>Departures</span><span>{c.schedule.title}</span></div>
      <div className={s.countRow} aria-label={c.countdown.title}>
        {COUNT_UNITS.map(([key, label]) => <div key={key}><Flaps text={key === "days" ? String(count?.days ?? "---").padStart(3, "0") : pad(count?.[key])} /><span>{label}</span></div>)}
      </div>
      <table className={s.table}>
        <thead><tr><th>Time</th><th>Event</th><th className={s.hideSm}>Gate</th><th>Status</th></tr></thead>
        {days.map(({ day, items }, d) => <tbody key={d}>
          {day && <tr className={s.dayRow}><td colSpan={4}>{day}</td></tr>}
          {items.map((item, i) => {
            const t = cleanTime(item.time);
            const status = row++ === 0 ? "Boarding" : "On time";
            return <tr key={i}>
              <td className={s.time}>{t.time}</td>
              <td className={s.what}>{item.title}{item.location && <small className={s.showSm}>{item.location}</small>}</td>
              <td className={s.hideSm}>{item.location || "Main"}</td>
              <td><span className={status === "Boarding" ? s.boarding : s.ontime}>{status}</span></td>
            </tr>;
          })}
        </tbody>)}
      </table>
    </section>

    <section id="pg-destination" className={s.destination}>
      <article className={s.postcard} data-reveal="tilt" style={{ "--tilt": "-4deg", "--rest": "-1.5deg" }}>
        <figure><img src={c.location.image || photoFor(c, 1)} alt={c.location.name} loading="lazy" /><span className={s.greet}>Greetings from</span></figure>
        <div className={s.back}>
          <span className={s.stamp} aria-hidden="true"><img src={photoFor(c, 2)} alt="" /></span>
          <span className={s.postmark} aria-hidden="true">{w.day}·{w.monthNum}·{w.yy}</span>
          <p className={s.label}>Destination</p>
          <h2>{c.location.name}</h2>
          <p className={s.address}>{c.location.address}</p>
          <p className={s.note}>Wish you were here — so please be!</p>
        </div>
      </article>
      <MapFrame c={c} className={s.map} />
    </section>

    {(c.dressCode.text || c.gifts.text) && <section id="pg-luggage" className={s.luggage}>
      {c.dressCode.text && <article data-reveal="left"><span className={s.tagHole} aria-hidden="true" /><p className={s.label}>Baggage allowance</p><h3>{c.dressCode.title}</h3><p>{c.dressCode.text}</p></article>}
      {c.gifts.text && <article data-reveal="right"><span className={s.tagHole} aria-hidden="true" /><p className={s.label}>Duty free</p><h3>{c.gifts.title}</h3><p>{c.gifts.text}</p></article>}
    </section>}

    <section id="rsvp" className={s.checkin}>
      <div className={s.checkCard} data-reveal="up">
        <p className={s.label}>Online check-in · closes soon</p>
        <h2>{c.rsvp.title}</h2>
        <p className={s.lead}>{c.rsvp.text}</p>
        <Rsvp c={c} submitLabel="Check in" />
      </div>
    </section>

    <section id="pg-closing" className={s.closing}>
      <div className={s.window} data-reveal="zoom"><ClosingMedia c={c} /></div>
      <p className={s.label}>Now boarding</p>
      <h2>{c.closing.title}</h2>
      <p className={s.sign}>{first} &amp; {second}{c.hashtag && <> · {c.hashtag}</>}</p>
    </section>
  </div>;
}

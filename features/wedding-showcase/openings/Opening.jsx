"use client";
import { useEffect, useRef, useState } from "react";
import s from "./Opening.module.css";

/*
 * Opening screens for the sample wedding websites, each with its own idea rather than one cloth in another colour:
 *  envelope  — ribbon (silk ribbon and bow that untie, the flap lifts and the card rises out); the other paper
 *              envelopes are in ../EnvelopeIntro.jsx
 *  curtains  — theatre (proscenium, marquee sign with bulbs, the curtain flies up), sunlit (chiffon blowing apart in a
 *              sunlit window, fairy lights, hanging wooden sign), satin (blush satin drapes under pearl swags), mandap
 *              (mandap pillars and genda strings), lace (lace panels drawn aside), cabana (beach linen in the wind),
 *              lights (a curtain of fairy lights that parts)
 * colors: { main, dark, trim, ink }. thumb: drawn inside its parent (a card on /wedding/webpages) instead of over the page;
 * `play` then opens it (on hover) and closes it again when it turns off.
 */
const OPEN_MS = { ribbon: 2600, theatre: 2000, sunlit: 1900, satin: 1900, mandap: 2000, lace: 1900, cabana: 1900, lights: 2000 };
export const OPENINGS = Object.keys(OPEN_MS);

const cx = (...names) => names.filter(Boolean).join(" ");
const range = (n) => Array.from({ length: n }, (_, i) => i);

function Ribbon({ sign, names, date }) {
  return <div className={s.table}>
    <div className={s.envelope}>
      <div className={s.envBack} />
      <div className={s.card}>{sign}</div>
      <div className={s.envFront} />
      <div className={s.address}><small>For our dearest guest</small><b>{names}</b><i />{date && <small>{date}</small>}</div>
      <div className={s.flap} />
      <div className={s.ribbonV} /><div className={s.ribbonH} />
      <div className={s.bow}><i /><i /><b /><em /><em /></div>
    </div>
  </div>;
}

function Theatre({ sign }) {
  return <>
    <div className={s.house} />
    <div className={s.beam} /><div className={cx(s.beam, s.beam2)} />
    <div className={s.stageCurtain}><span className={s.fringe} /></div>
    <div className={s.valance}>{range(7).map((i) => <i key={i} />)}</div>
    <div className={s.proscenium} />
    <div className={s.marquee}>{sign}</div>
  </>;
}

function Sheer({ sign, photo }) {
  return <>
    <div className={s.window} style={photo ? { "--photo": `url("${photo}")` } : undefined} />
    {[1, 2, 3].map((k) => <div key={k} className={cx(s.chiffon, s[`c${k}`])}><i className={s.cl} /><i className={s.cr} /></div>)}
    <svg className={s.fairy} viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true"><path d="M0 2 Q 25 16 50 6 T 100 3" /></svg>
    <div className={s.bulbs}>{range(11).map((i) => <i key={i} style={{ "--i": i }} />)}</div>
    <div className={s.plank}><span className={s.rope} /><span className={cx(s.rope, s.rope2)} />{sign}</div>
  </>;
}

/** Pearl strings hanging in swags along the top: [x, y] for each pearl, `swags` arcs across the width. */
const PEARLS = (swags, per) => Array.from({ length: swags * per }, (_, i) => {
  const k = Math.floor(i / per), t = (i % per) / (per - 1);
  return [((k + t) / swags) * 100, 4 + Math.sin(t * Math.PI) * 9];
});

function Satin({ sign }) {
  return <>
    <div className={s.satinGlow} />
    <div className={cx(s.drape, s.satinL)} /><div className={cx(s.drape, s.satinR)} />
    <div className={s.pearls}>{PEARLS(3, 15).map(([x, y], i) => <i key={i} style={{ left: `${x}%`, top: `${y}%` }} />)}</div>
    <div className={s.petalFall}>{range(18).map((i) => <i key={i} style={{ "--i": i }} />)}</div>
    <div className={s.mirror}>{sign}</div>
  </>;
}

function Marigold({ sign }) {
  return <>
    <div className={s.mandapBg} />
    <div className={s.strings}>{range(16).map((i) => <i key={i} style={{ "--i": i, "--side": i < 8 ? -1 : 1, "--far": Math.abs(i - 7.5) / 8, "--len": `${70 + ((i * 29) % 25)}%` }} />)}</div>
    <div className={cx(s.pillar, s.pL)} /><div className={cx(s.pillar, s.pR)} />
    <div className={s.toranTop}>{range(13).map((i) => <i key={i} />)}</div>
    <div className={s.board}>{sign}</div>
  </>;
}

function Lace({ sign }) {
  return <>
    <div className={s.dusk} />
    <div className={cx(s.lacePanel, s.lL)}><span className={s.tie} /></div>
    <div className={cx(s.lacePanel, s.lR)}><span className={s.tie} /></div>
    <div className={s.rod} />
    <div className={s.cameo}>{sign}</div>
  </>;
}

function Cabana({ sign }) {
  return <>
    <div className={s.beach}><span className={s.sun} /><span className={s.sea} /></div>
    {[1, 2].map((k) => <div key={k} className={cx(s.linen, s[`n${k}`])}><i className={s.cl} /><i className={s.cr} /></div>)}
    <div className={s.bamboo} />
    <div className={s.drift}>{sign}</div>
  </>;
}

function Lights({ sign }) {
  return <>
    <div className={s.night} />
    <div className={s.lightStrings}>{range(22).map((i) => <i key={i} style={{ "--i": i, "--side": i < 11 ? -1 : 1, "--far": Math.abs(i - 10.5) / 11 }} />)}</div>
    <div className={s.neon}>{sign}</div>
  </>;
}

const SCENES = { ribbon: Ribbon, theatre: Theatre, sunlit: Sheer, satin: Satin, mandap: Marigold, lace: Lace, cabana: Cabana, lights: Lights };
const KICKER = { theatre: "Now showing", sunlit: "Welcome to the wedding of", satin: "With love", mandap: "Shubh Vivah", lace: "Together with their families", cabana: "Sand, sea & forever", lights: "Join us under the lights", ribbon: "You are invited" };

export default function Opening({ variant, colors = {}, names, date, photo, kicker, tapLabel = "Tap to open", thumb = false, play = false, onOpen, onDone }) {
  const [state, setState] = useState("closed"); // closed → opening → open
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  // thumbnails: open while `play`, close again after
  useEffect(() => { if (thumb) setState(play ? "opening" : "closed"); }, [thumb, play]);
  const open = () => {
    if (thumb || state !== "closed") return;
    setState("opening");
    onOpen?.();
    timer.current = window.setTimeout(() => { setState("open"); onDone?.(); }, OPEN_MS[variant] ?? 2400);
  };
  const Scene = SCENES[variant] ?? Ribbon;
  const vars = { "--main": colors.main, "--dark": colors.dark, "--trim": colors.trim, "--ink": colors.ink };
  const sign = <div className={s.sign}>
    <p className={s.kicker}>{kicker ?? KICKER[variant]}</p>
    <p className={s.names}>{names}</p>
    {date && <p className={s.date}>{date}</p>}
  </div>;
  return <div className={cx(s.stage, s[variant], thumb && s.thumb, state !== "closed" && s.opening, state === "open" && s.gone)} style={vars}
    aria-hidden={thumb || state === "open"} onClick={open}>
    <Scene sign={sign} photo={photo} names={names} date={date} />
    {!thumb && <button type="button" className={s.tap} onClick={(e) => { e.stopPropagation(); open(); }} aria-label={`${tapLabel} the invitation`}>
      <span className={s.tapDot} aria-hidden="true" />{tapLabel}
    </button>}
  </div>;
}

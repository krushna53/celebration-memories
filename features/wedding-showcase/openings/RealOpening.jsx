"use client";
import { useEffect, useRef, useState } from "react";
import s from "./RealOpening.module.css";

/*
 * Three photo-real openings, drawn from textures rendered for them (public/showcase/real):
 *  stagevelvet — crimson velvet stage curtains under a swagged pelmet; they gather into folds at the sides
 *  teakdoor    — carved teak doors with brass studs and ring knockers in a lime-washed wall; they swing in
 *  waxenvelope — a maroon paper envelope with a gold wax seal; the seal breaks, the flap lifts, the card slides out
 * Same props as the other openings. thumb draws it inside its parent (a gallery card) and opens it while `play`.
 */
const OPEN_MS = { stagevelvet: 2300, teakdoor: 2500, waxenvelope: 2900 };
export const REAL_OPENINGS = Object.keys(OPEN_MS);
const STRIPS = 12;
const IMG = "/showcase/real/";

const cx = (...names) => names.filter(Boolean).join(" ");

function Curtain() {
  const half = (side) => <div className={cx(s.half, side)}>
    {Array.from({ length: STRIPS }, (_, i) => <i key={i} className={s.strip} style={{ "--i": i }} />)}
  </div>;
  return <>
    <div className={s.stageBack} />
    {half(s.halfL)}{half(s.halfR)}
    <div className={s.pelmet} />
    <div className={s.footlight} />
    <div className={s.boards} />
  </>;
}

function Doors() {
  return <>
    <div className={s.wall} />
    <div className={s.toran} aria-hidden="true">{Array.from({ length: 15 }, (_, i) => <i key={i} />)}</div>
    <div className={s.inside}><div className={s.glow} /></div>
    <div className={s.doorway}>
      <div className={cx(s.leaf, s.leafL)}><span className={s.shade} /></div>
      <div className={cx(s.leaf, s.leafR)}><span className={s.shade} /></div>
    </div>
    <div className={s.step} />
    <div className={cx(s.lamp, s.lampL)}><i /></div>
    <div className={cx(s.lamp, s.lampR)}><i /></div>
  </>;
}

function Envelope({ monogram, kicker, names, date }) {
  return <div className={s.table}>
    <div className={s.envelope}>
      <img className={s.liner} src={`${IMG}env-liner.webp`} alt="" draggable={false} />
      <div className={s.card}>
        <p className={s.cardKicker}>{kicker}</p>
        <p className={s.cardNames}>{names}</p>
        {date && <p className={s.cardDate}>{date}</p>}
      </div>
      <img className={s.pocket} src={`${IMG}env-pocket.webp`} alt="" draggable={false} />
      <div className={s.flap}>
        <img className={s.flapOut} src={`${IMG}env-flap.webp`} alt="" draggable={false} />
        <img className={s.flapIn} src={`${IMG}env-flap-inside.webp`} alt="" draggable={false} />
      </div>
      <div className={s.seal}>
        <span className={s.sealHalf}><b>{monogram}</b></span>
        <span className={cx(s.sealHalf, s.sealRight)}><b>{monogram}</b></span>
      </div>
    </div>
  </div>;
}

const KICKER = { stagevelvet: "Now showing", teakdoor: "The wedding of", waxenvelope: "You are invited" };

export default function RealOpening({ variant, colors = {}, monogram, names, date, kicker, tapLabel = "Tap to open", thumb = false, play = false, onOpen, onDone }) {
  const [state, setState] = useState("closed"); // closed → opening → open
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => { if (thumb) setState(play ? "opening" : "closed"); }, [thumb, play]);
  const open = () => {
    if (thumb || state !== "closed") return;
    setState("opening");
    onOpen?.();
    timer.current = window.setTimeout(() => { setState("open"); onDone?.(); }, OPEN_MS[variant] ?? 2400);
  };
  const vars = { "--main": colors.main, "--dark": colors.dark, "--trim": colors.trim, "--ink": colors.ink, "--ms": `${OPEN_MS[variant] ?? 2400}ms` };
  const words = kicker ?? KICKER[variant];
  return <div className={cx(s.stage, s[variant], thumb && s.thumb, state !== "closed" && s.opening, state === "open" && s.gone)} style={vars}
    aria-hidden={thumb || state === "open"} onClick={open}>
    {variant === "stagevelvet" && <Curtain />}
    {variant === "teakdoor" && <Doors />}
    {variant === "waxenvelope" && <Envelope monogram={monogram} kicker={words} names={names} date={date} />}
    {variant !== "waxenvelope" && <div className={s.sign}>
      <p className={s.kicker}>{words}</p>
      <p className={s.names}>{names}</p>
      {date && <p className={s.date}>{date}</p>}
    </div>}
    {!thumb && <button type="button" className={s.tap} onClick={(e) => { e.stopPropagation(); open(); }} aria-label={`${tapLabel} the invitation`}>{tapLabel}</button>}
  </div>;
}

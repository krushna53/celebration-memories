"use client";
import { useEffect, useRef, useState } from "react";
import s from "./ModernOpening.module.css";

const DURATIONS = { envelope: 2200, drape: 1900, gate: 2100 };
const cx = (...classes) => classes.filter(Boolean).join(" ");

/**
 * A deliberately small set of opening movements shared by every showcase design.
 * The page's palette is passed in, so an opening reads as the first moment of the
 * selected invitation rather than a separate, unrelated template.
 */
export default function ModernOpening({ family, colors = {}, monogram, names, date, thumb = false, play = false, onOpen, onDone }) {
  const [state, setState] = useState("closed");
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => { if (thumb) setState(play ? "opening" : "closed"); }, [thumb, play]);
  const open = () => {
    if (thumb || state !== "closed") return;
    setState("opening");
    onOpen?.();
    timer.current = window.setTimeout(() => { setState("open"); onDone?.(); }, DURATIONS[family] ?? 2000);
  };
  const vars = { "--opening-main": colors.main, "--opening-dark": colors.dark, "--opening-trim": colors.trim, "--opening-ink": colors.ink };
  const invitation = <div className={s.invitation}>
    <span className={s.kicker}>THE WEDDING OF</span>
    <strong>{names}</strong>
    {date && <span className={s.date}>{date}</span>}
  </div>;
  return <div className={cx(s.stage, s[family], thumb && s.thumb, state === "opening" && s.opening, state === "open" && s.gone)} style={vars} onClick={open} aria-hidden={thumb || state === "open"}>
    <div className={s.glow} />
    {family === "envelope" && <div className={s.envelopeArt}>
      {invitation}<i className={s.envelopeBack} /><i className={s.envelopeFront} /><i className={s.flap} />
      <i className={s.seal}>{monogram}</i>
    </div>}
    {family === "drape" && <div className={s.drapeArt}>
      <i className={cx(s.curtain, s.left)} /><i className={cx(s.curtain, s.right)} />
      <i className={s.valance} />{invitation}
    </div>}
    {family === "gate" && <div className={s.gateArt}>
      <i className={s.arch} /><i className={cx(s.door, s.left)} /><i className={cx(s.door, s.right)} />
      <i className={s.gateSeal}>{monogram}</i>{invitation}
    </div>}
    {!thumb && <button className={s.tap} type="button" onClick={(event) => { event.stopPropagation(); open(); }}>Tap to open</button>}
  </div>;
}

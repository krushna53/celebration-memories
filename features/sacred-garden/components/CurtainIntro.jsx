"use client";
import { useMemo, useState } from "react";
import s from "./CurtainIntro.module.css";
import { cx } from "./shared";

/**
 * Full-screen velvet curtains that part when tapped (a stage-reveal intro).
 * Same props as IntroCover, so the two can be swapped.
 * Curtain colour: set --inv-curtain / --inv-curtain-dark on a parent.
 */
export default function CurtainIntro({ monogram = "K & A", guestLine = "You're invited", kicker = "THE WEDDING OF", tapLabel = "Tap to open", brand = "EveryMoment", onOpen, onDone }) {
  const [state, setState] = useState("closed"); // closed → opening → open
  const petals = useMemo(() => Array.from({ length: 22 }, (_, i) => {
    const a = (i / 22) * Math.PI * 2;
    const dist = 180 + (i % 4) * 70;
    return { "--x": `${Math.cos(a) * dist}px`, "--y": `${Math.sin(a) * dist}px`, "--r": `${(i % 2 ? 1 : -1) * (120 + i * 17)}deg`, animationDelay: `${(i % 5) * 40}ms` };
  }), []);
  const open = () => {
    if (state !== "closed") return;
    setState("opening");
    onOpen?.();
    window.setTimeout(() => { setState("open"); onDone?.(); }, 2600);
  };
  return <div className={cx(s.stage, state !== "closed" && s.opening, state === "open" && s.gone)} aria-hidden={state === "open"}>
    <div className={cx(s.panel, s.left)}><span className={s.tassel} /></div>
    <div className={cx(s.panel, s.right)}><span className={s.tassel} /></div>
    <div className={s.valance} />
    <div className={s.content}>
      <p className={s.kicker}>{kicker}</p>
      <p className={s.guest}>{guestLine}</p>
      <button type="button" className={s.seal} onClick={open} aria-label={`${tapLabel} the invitation`}>
        <span className={s.monogram}>{monogram}</span>
      </button>
      <p className={s.tap}>{tapLabel}</p>
      {brand && <p className={s.brand}>An invitation by <b>{brand}</b></p>}
    </div>
    <div className={s.petals} aria-hidden="true">{petals.map((style, i) => <i key={i} style={style} />)}</div>
  </div>;
}

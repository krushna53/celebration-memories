"use client";
import { useState } from "react";
import s from "./SageDoorIntro.module.css";
import { cx } from "./shared";

/**
 * Embossed sage double doors that swing open in 3D, with a cream "tap to open" cartouche.
 * onOpen runs inside the tap (so music can start); onDone runs once the doors are open.
 */
export default function SageDoorIntro({ names = "", tapLabel = "Tap to open", onOpen, onDone }) {
  const [state, setState] = useState("closed"); // closed → opening → open
  const open = () => {
    if (state !== "closed") return;
    setState("opening");
    onOpen?.();
    window.setTimeout(() => { setState("open"); onDone?.(); }, 2000);
  };
  return <div className={cx(s.stage, state !== "closed" && s.opening, state === "open" && s.gone)} aria-hidden={state === "open"}>
    <div className={s.glow} />
    {names && <p className={s.names}>{names}</p>}
    <div className={cx(s.door, s.left)}><span className={s.panel} /></div>
    <div className={cx(s.door, s.right)}><span className={s.panel} /></div>
    <span className={s.seam} aria-hidden="true" />
    <button type="button" className={s.cartouche} onClick={open} aria-label={`${tapLabel} the invitation`}>
      <span className={s.leaf} aria-hidden="true">❦</span>
      <span className={s.rule} aria-hidden="true" />
      <span className={s.tap}>{tapLabel}</span>
      <span className={s.rule} aria-hidden="true" />
      <span className={s.leaf} aria-hidden="true">❦</span>
    </button>
  </div>;
}

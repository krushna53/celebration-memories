"use client";
import { useState } from "react";
import s from "./IntroCover.module.css";
import { cx } from "./shared";

/**
 * Full-screen "tap to open" doors shown before the invitation.
 * onOpen fires on the tap itself, so it can start music (browsers need a user gesture).
 */
export default function IntroCover({ monogram = "K & A", guestLine = "You're invited", kicker = "THE WEDDING OF", tapLabel = "Tap to open", brand = "EveryMoment", onOpen, onDone }) {
  const [state, setState] = useState("closed"); // closed → opening → open
  const open = () => {
    if (state !== "closed") return;
    setState("opening");
    onOpen?.();
    window.setTimeout(() => { setState("open"); onDone?.(); }, 1700);
  };
  return <div className={cx(s.cover, state !== "closed" && s.opening, state === "open" && s.gone)} aria-hidden={state === "open"}>
    <div className={cx(s.door, s.doorLeft)} />
    <div className={cx(s.door, s.doorRight)} />
    <div className={s.content}>
      <p className={s.kicker}>{kicker}</p>
      <p className={s.guest}>{guestLine}</p>
      <button type="button" className={s.seal} onClick={open} aria-label={`${tapLabel} the invitation`}>
        <span className={s.monogram}>{monogram}</span>
      </button>
      <p className={s.tap}>{tapLabel}</p>
    </div>
    {brand && <p className={s.brand}>An invitation by <b>{brand}</b></p>}
  </div>;
}

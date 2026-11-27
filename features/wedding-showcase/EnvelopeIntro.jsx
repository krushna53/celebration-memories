"use client";
import { useEffect, useRef, useState } from "react";
import s from "./EnvelopeIntro.module.css";

/*
 * Paper envelope openings drawn in CSS, one look per `variant` (same props as ShowcaseIntro):
 *  pocket   — a tall pocket fold with a belly band; the band slips off and the card slides up out of the pocket
 *  gatefold — two side flaps closed with a wax seal; they swing open like gates onto the card
 *  lasercut — a laser-cut jali envelope over a gold liner; the flap lifts and the card rises out
 *  airmail  — a striped airmail envelope with stamp and postmark; it turns over, the flap opens, the letter slides out
 * colours: { main, dark, trim, ink } — paper, backdrop, gold / seal, lettering on the card.
 */
const OPEN_MS = { pocket: 2800, gatefold: 2700, lasercut: 3000, airmail: 3400 };

const cx = (...names) => names.filter(Boolean).join(" ");

function Card({ kicker, names, date }) {
  return <div className={s.card}>
    <span className={s.cardKicker}>{kicker}</span>
    <span className={s.cardNames}>{names}</span>
    {date && <span className={s.cardDate}>{date}</span>}
  </div>;
}

/** autoOpen: seconds after which it opens by itself (0 = wait for a tap). */
export default function EnvelopeIntro({ variant, colors = {}, monogram, names, date, kicker = "The wedding of", tapLabel = "Tap to open", autoOpen = 0, thumb = false, play = false, onOpen, onDone }) {
  const [state, setState] = useState("closed"); // closed → opening → open
  const opened = useRef(false);
  // thumbnails (thumb): open while `play` (the card is hovered), close again after
  useEffect(() => { if (thumb) setState(play ? "opening" : "closed"); }, [thumb, play]);
  const open = () => {
    if (thumb || opened.current) return;
    opened.current = true;
    setState("opening");
    onOpen?.();
    window.setTimeout(() => { setState("open"); onDone?.(); }, OPEN_MS[variant] ?? 2800);
  };
  const openRef = useRef(open);
  openRef.current = open;
  useEffect(() => {
    if (!autoOpen || thumb) return undefined;
    const t = window.setTimeout(() => openRef.current(), autoOpen * 1000);
    return () => window.clearTimeout(t);
  }, [autoOpen, thumb]);
  const vars = { "--ms": `${OPEN_MS[variant] ?? 2800}ms`, "--main": colors.main, "--dark": colors.dark, "--trim": colors.trim, "--ink": colors.ink };
  const seal = <span className={s.seal}>{monogram}</span>;
  const card = <Card kicker={kicker} names={names} date={date} />;

  let art = null;
  switch (variant) {
    case "pocket":
      art = <div className={s.pocketWrap}>
        <div className={s.pocketBack} />
        {card}
        <div className={s.pocketFront}><span className={s.pocketLine} /></div>
        <div className={s.band}>{seal}</div>
      </div>;
      break;
    case "gatefold":
      art = <div className={s.gateWrap}>
        {card}
        <div className={cx(s.gate, s.gateL)}><i /></div>
        <div className={cx(s.gate, s.gateR)}><i /></div>
        <div className={s.gateSeal}>{seal}</div>
      </div>;
      break;
    case "lasercut":
      art = <div className={s.laserWrap}>
        <div className={s.laserBack} />
        {card}
        <div className={s.laserFront} />
        <div className={s.laserFlap}><div className={s.flapFace} /><div className={s.flapInside} /></div>
        <div className={s.laserSeal}>{seal}</div>
      </div>;
      break;
    case "airmail":
      art = <div className={s.airWrap}>
        <div className={s.airFlip}>
          <div className={s.airFront}>
            <span className={s.stamp}>{monogram}</span>
            <span className={s.postmark}>{date}</span>
            <span className={s.address}><b>To our dearest guest</b><i /><i /><i /></span>
            <span className={s.parAvion}>Par avion · By air mail</span>
          </div>
          <div className={s.airBack}>
            {card}
            <div className={s.airPocket} />
            <div className={s.airFlap} />
          </div>
        </div>
      </div>;
      break;
    default:
      art = null;
  }

  return <div className={cx(s.stage, s[variant], state !== "closed" && s.opening, state === "open" && s.gone)} style={vars} aria-hidden={state === "open"} onClick={open}>
    <div className={s.scene}>{art}</div>
    {!thumb && <div className={s.prompt}>
      <button type="button" className={s.tap} onClick={(e) => { e.stopPropagation(); open(); }} aria-label={`${tapLabel} the invitation`}>{tapLabel}</button>
    </div>}
  </div>;
}

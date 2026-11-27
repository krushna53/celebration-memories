"use client";
import { useEffect, useState } from "react";
import s from "./ShowcaseIntro.module.css";

/*
 * Opening screens for the sample wedding websites, one look per `variant`, all with the same props:
 *  curtains — rise (theatre drape lifts), sheer (layered chiffon with fairy lights), swag (drapes gather to
 *             the top corners), double (velvet, then lace), marigold / pearls (strings of flowers or pearls part)
 *  doors    — temple (carved doors, bells and a leaf toran), jali (lattice screens slide into a Mughal arch),
 *             haveli (arched studded palace doors), glass (frosted chapel doors slide apart)
 * colours: { main, dark, trim, ink } — cloth / door, its shadow, gold work, lettering.
 * onOpen runs inside the tap (so music can start); onDone once the page is uncovered.
 */
const OPEN_MS = { rise: 2400, sheer: 2600, swag: 2400, double: 3000, marigold: 2600, pearls: 2600, temple: 2400, jali: 2400, haveli: 2400, glass: 2200, flowerdoor: 4400 };
const STRINGS = 26;

const cx = (...names) => names.filter(Boolean).join(" ");
const pair = (cls) => <><div className={cx(cls, s.left)} /><div className={cx(cls, s.right)} /></>;

function Layers({ variant, monogram, names, date, photo }) {
  switch (variant) {
    case "rise":
      return <><div className={s.footlights} /><div className={s.drape}><span className={s.fringe} /></div></>;
    case "sheer":
      return <>{pair(s.sheer1)}{pair(s.sheer2)}{pair(s.sheer3)}<div className={s.fairy} /></>;
    case "swag":
      return <>{pair(s.swagPanel)}<div className={s.pelmet}><i /><i /></div></>;
    case "double":
      return <>{pair(s.lace)}{pair(s.velvet)}<div className={s.rod} /></>;
    case "marigold":
    case "pearls":
      return <>
        <div className={s.backdrop} />
        {Array.from({ length: STRINGS }, (_, i) => {
          const side = i < STRINGS / 2 ? -1 : 1, fromCentre = Math.abs(i + 0.5 - STRINGS / 2) / (STRINGS / 2);
          return <i key={i} className={s.string} style={{ left: `${(i + 0.5) * (100 / STRINGS)}%`, "--side": side, "--far": fromCentre.toFixed(3), "--len": `${80 + ((i * 37) % 17)}%` }} />;
        })}
        <div className={s.garland} />
      </>;
    case "temple":
      return <><div className={s.frame} />{pair(s.templeDoor)}<div className={s.toran} /><div className={s.bells}><i /><i /></div></>;
    case "jali":
      return <><div className={s.archWall} />{pair(s.jaliPanel)}</>;
    case "haveli":
      return <><div className={s.frame} />{pair(s.haveliDoor)}</>;
    case "glass":
      return <><div className={s.chapel} />{pair(s.glassPanel)}</>;
    case "flowerdoor":
      return <><div className={s.flowerDoorFrame} /><div className={s.flowerCard}>
        <div className={s.flowerCardPhoto}><img src={photo} alt="" /></div>
        <div className={s.flowerCardCopy}><span>THE WEDDING OF</span><b>{names}</b>{date && <small>{date}</small>}<i aria-hidden="true">❧ ✿ ❧</i></div>
      </div>{pair(s.flowerDoor)}<span className={s.flowerSeal} aria-hidden="true">✿</span></>;
    default:
      return null;
  }
}

export default function ShowcaseIntro({ variant, colors = {}, monogram, names, photo, kicker = "The wedding of", date, tapLabel = "Tap to open", thumb = false, play = false, onOpen, onDone }) {
  const [state, setState] = useState("closed"); // closed → opening → open
  // thumbnails (thumb): open while `play` (the card is hovered), close again after
  useEffect(() => { if (thumb) setState(play ? "opening" : "closed"); }, [thumb, play]);
  const open = () => {
    if (thumb || state !== "closed") return;
    setState("opening");
    onOpen?.();
    window.setTimeout(() => { setState("open"); onDone?.(); }, OPEN_MS[variant] ?? 2400);
  };
  const vars = { "--main": colors.main, "--dark": colors.dark, "--trim": colors.trim, "--ink": colors.ink };
  return <div className={cx(s.stage, s[variant], state !== "closed" && s.opening, state === "open" && s.gone)} style={vars} aria-hidden={state === "open"} onClick={open}>
    <Layers variant={variant} monogram={monogram} names={names} date={date} photo={photo} />
    <div className={s.content}>
      <p className={s.kicker}>{kicker}</p>
      <p className={s.names}>{names}</p>
      {date && <p className={s.date}>{date}</p>}
      <button type="button" className={s.tap} onClick={(e) => { e.stopPropagation(); open(); }} aria-label={`${tapLabel} the invitation`}>
        {monogram && <span className={s.monogram}>{monogram}</span>}
        <span className={s.label}>{tapLabel}</span>
      </button>
    </div>
  </div>;
}

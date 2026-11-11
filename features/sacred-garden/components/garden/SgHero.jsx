"use client";
import { useEffect, useRef } from "react";
import { Artboard, El } from "./Artboard";
import g from "./garden.module.css";
import { SG_ART } from "./assets";
import s from "./SgHero.module.css";

// the bouquets breathe: grow a little and tilt, then settle, forever
const swayL = { ev: "intoview", trg: 1, loop: true, list: [{}, { sx: 1.06, ro: 2, ti: 2000 }, { ti: 2000 }] };
const swayR = { ev: "intoview", trg: 1, loop: true, list: [{}, { sx: 1.04, ro: -2, ti: 2000 }, { ti: 2000 }] };
const bob = { ev: "intoview", trg: 1, loop: true, list: [{}, { my: 5, ti: 600 }, { ti: 500 }] };
const rise = { style: "fadeinup", dur: 2, delay: 3, dist: 30 };

export function Chevron({ up = false }) {
  return <svg className={g.chev} viewBox="0 0 25 16" fill="none" aria-hidden="true">
    <path d={up ? "M2 14L12.5 3L23 14" : "M2 2L12.5 13L23 2"} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

// what counts as a tap: iOS only lets a film start inside one of these when autoplay was refused
const GESTURES = ["pointerup", "touchend", "click", "keydown"];

/**
 * The looping cover film. iPhone Low Power Mode refuses autoplay (the poster stays up),
 * so it tries again on the guest's first tap anywhere on the page.
 */
function HeroFilm({ src, poster }) {
  const ref = useRef(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return undefined;
    const start = () => {
      if (!v.paused) return stop();
      v.play()?.then(stop).catch(() => {});
    };
    const stop = () => GESTURES.forEach((type) => window.removeEventListener(type, start, true));
    GESTURES.forEach((type) => window.addEventListener(type, start, { capture: true, passive: true }));
    start();
    return stop;
  }, [src]);
  return <video ref={ref} className={s.film} autoPlay muted loop playsInline preload="auto" poster={poster}><source src={src} type="video/mp4" /></video>;
}

/**
 * Cover film (or picture) with the names, then the welcome on torn paper below it.
 * video: looping cover film; art: picture used when there is no film; photo: the couple's photo, shown faintly in the arch behind the names.
 * firstParents / secondParents: a small line under each name (e.g. "S/O Mrs. … and Mr. …"); with them the names sit apart.
 * blessing: a line above the welcome; blessingImage: the same as a picture (e.g. calligraphy).
 */
export default function SgHero({ id = "sg-hero", first, second, firstParents, secondParents, date, weddingDay = "Wedding Day", scrollLabel = "Scroll down", blessing, blessingImage, title, message, nextId,
  video, art, photo, bouquets = [SG_ART.bouquetHeroLeft, SG_ART.bouquetHeroRight] }) {
  return <Artboard id={id} height={1240} label={`${first} and ${second}`}>
    <El x={0} y={0} w={450}>
      {video
        ? <HeroFilm src={video} poster={art} />
        : art && <img className={s.film} src={art} alt="" />}
    </El>
    <El x={0} y={0} w={450} h={676} className={s.glow} />
    {photo && <El x={60} y={40} w={330} h={520}><img className={s.photo} src={photo} alt="" /></El>}
    <El x={-147} y={753} w={744} h={487} m={{ y: 763 }}><img className={g.stretch} src={SG_ART.paperHero} alt="" /></El>
    {firstParents || secondParents ? <>
      {/* each name with its parents' line under it, "&" between the two */}
      <El x={-55} y={250} w={560} h={60} appear={rise}><h1 className={`${g.text} ${s.names}`}>{first}<span className={s.hidden}> and {second}</span></h1></El>
      {firstParents && <El x={20} y={318} w={410} h={24} appear={rise}><p className={`${g.text} ${s.parents}`}>{firstParents}</p></El>}
      <El x={-55} y={404} w={560} h={60} appear={rise}><p className={`${g.text} ${s.names}`} aria-hidden="true">{second}</p></El>
      {secondParents && <El x={20} y={472} w={410} h={24} appear={rise}><p className={`${g.text} ${s.parents}`}>{secondParents}</p></El>}
    </>
      : <El x={-55} y={294} w={560} h={168} appear={rise}><h1 className={`${g.text} ${s.names}`}>{first}{"\n\n"}{second}</h1></El>}
    <El x={-55} y={154} w={560} h={37} appear={rise}><p className={`${g.text} ${s.day}`}>{weddingDay}</p></El>
    <El x={-55} y={196} w={560} h={37} appear={rise}><p data-no-translate className={`${g.text} ${g.num} ${s.date}`}>{date}</p></El>
    <El x={203} y={firstParents || secondParents ? 352 : 356} w={55} h={44} appear={rise}><p className={`${g.text} ${s.amp}`} aria-hidden="true">&amp;</p></El>
    <El x={-16} y={566} w={224} h={343} m={{ x: -12, y: 568, w: 218, h: 334 }} steps={swayL}><img src={bouquets[0]} alt="" /></El>
    <El x={230} y={547} w={236} h={359} m={{ x: 263, y: 586, w: 210, h: 319 }} steps={swayR}><img src={bouquets[1]} alt="" /></El>
    {title && <El x={-55} y={899} w={560} h={129} appear={{ style: "fadein", dur: 1 }}><h2 className={`${g.text} ${g.title} ${s.welcomeTitle}`}>{title}</h2></El>}
    {message && <El x={72} y={1050} w={307} appear={{ style: "fadein", dur: 2, delay: 0.2 }}><p className={`${g.text} ${g.body}`}>{message}</p></El>}
    <El x={213} y={782} w={25} h={16} steps={bob}><Chevron /></El>
    <El x={67} y={742} w={316} h={35}><a className={`${g.link} ${g.text} ${s.scroll}`} href={nextId ? `#${nextId}` : undefined}>{scrollLabel}</a></El>
    {blessingImage
      ? <El x={84} y={813} w={283} h={86}><img src={blessingImage} alt={blessing ?? ""} /></El>
      : blessing && <El x={44} y={813} w={363} h={86} className={g.fill}><p className={`${g.text} ${s.blessing}`}>{blessing}</p></El>}
  </Artboard>;
}

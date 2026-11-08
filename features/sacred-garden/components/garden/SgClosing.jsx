"use client";
import { useEffect, useRef } from "react";
import { Artboard, El } from "./Artboard";
import g from "./garden.module.css";
import { SG_ART } from "./assets";
import s from "./SgClosing.module.css";

const breathe = { ev: "blockintoview", trg: 1, loop: true, list: [{}, { sx: 1.02, ro: 1, ti: 2000 }, { ti: 2000 }] };

/** A silent looping video that loads and plays only while it is on screen (the reel is large). */
function ClosingVideo({ src, label }) {
  const ref = useRef(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return undefined;
    const seen = new IntersectionObserver(([e]) => { if (e.isIntersecting) v.play()?.catch(() => {}); else v.pause(); }, { threshold: 0.2 });
    seen.observe(v);
    return () => seen.disconnect();
  }, [src]);
  return <video ref={ref} className={g.cover} src={src} muted loop playsInline preload="none" aria-label={label} />;
}

/** Closing photo (or video) that fades up into the paper, "Hope to see you there!", the names and bouquets at the foot. */
export default function SgClosing({ id = "sg-closing", title = "Hope to see you there!", names, photo = SG_ART.couple, video, flowers = SG_ART.flowersClosing }) {
  return <Artboard id={id} height={673} label={title}>
    {video ? <El x={0} y={0} w={450} h={675}><ClosingVideo src={video} label={names ?? ""} /></El>
      : photo && <El x={0} y={0} w={450} h={675}><img className={g.cover} src={photo} alt={names ?? ""} loading="lazy" /></El>}
    <El x={0} y={-1} w={451} h={237} className={s.fade} />
    <El x={-55} y={12} w={560} h={64} appear={{ style: "fadein", dur: 1 }}><h2 className={`${g.text} ${g.title}`}>{title}</h2></El>
    <El x={-43} y={173} w={537} h={537} steps={breathe} className={s.flowers}><img src={flowers} alt="" /></El>
    {names && <El x={45} y={73} w={360} h={45} appear={{ style: "fadeinup", dur: 2, dist: 40 }}><p className={`${g.text} ${s.names}`}>{names}</p></El>}
  </Artboard>;
}

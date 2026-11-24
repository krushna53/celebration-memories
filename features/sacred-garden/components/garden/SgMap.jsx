"use client";
import { useEffect, useRef, useState } from "react";
import { Artboard, El } from "./Artboard";
import s from "./SgMap.module.css";
import { SG_ART } from "./assets";

/** Google map (no API key) in a gold rounded frame between two ornaments, with a directions button below. Loads when it nears the screen. */
export default function SgMap({ id = "sg-map", query, embedSrc, directions, title = "Map" }) {
  const ref = useRef(null);
  const [load, setLoad] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setLoad(true); io.disconnect(); } }, { rootMargin: "400px 0px" });
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return <Artboard id={id} height={directions ? 432 : 343} pt={60} pb={directions ? 40 : 60} label={title}>
    <El x={55} y={2} w={341} h={341} className={s.frame}><img src={SG_ART.mapFrame} alt="" /></El>
    <El x={57.5} y={4} w={335} h={335} className={s.map}>
      <div ref={ref} className={s.inner}>
        {load && (embedSrc || query) && <iframe title={title} src={embedSrc || `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=15&output=embed`} allowFullScreen referrerPolicy="no-referrer-when-downgrade" />}
      </div>
    </El>
    <El x={130} y={-26} w={190} h={42}><img src={SG_ART.ornamentTop} alt="" /></El>
    <El x={130} y={328} w={190} h={42}><img src={SG_ART.ornamentBottom} alt="" /></El>
    {directions && <El x={115} y={388} w={220} h={44} appear={{ style: "fadeinup", dur: 2, dist: 30 }}>
      <a className={s.directions} href={directions} target="_blank" rel="noopener noreferrer" aria-label={`Get directions to ${title} (opens Google Maps)`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
        Get Directions
      </a>
    </El>}
  </Artboard>;
}

"use client";
import { useEffect, useRef, useState } from "react";
import { Artboard, El } from "./Artboard";
import s from "./SgMap.module.css";
import { SG_ART } from "./assets";

/** Google map (no API key) in a gold rounded frame between two ornaments. Loads when it nears the screen. */
export default function SgMap({ id = "sg-map", query, embedSrc, title = "Map" }) {
  const ref = useRef(null);
  const [load, setLoad] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setLoad(true); io.disconnect(); } }, { rootMargin: "400px 0px" });
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return <Artboard id={id} height={343} pt={30} pb={60} label={title}>
    <El x={55} y={2} w={341} h={341} className={s.frame}><img src={SG_ART.mapFrame} alt="" /></El>
    <El x={57.5} y={4} w={335} h={335} className={s.map}>
      <div ref={ref} className={s.inner}>
        {load && (embedSrc || query) && <iframe title={title} src={embedSrc || `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=15&output=embed`} allowFullScreen referrerPolicy="no-referrer-when-downgrade" />}
      </div>
    </El>
    <El x={130} y={-26} w={190} h={42}><img src={SG_ART.ornamentTop} alt="" /></El>
    <El x={130} y={328} w={190} h={42}><img src={SG_ART.ornamentBottom} alt="" /></El>
  </Artboard>;
}

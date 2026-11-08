"use client";
import { useEffect, useRef, useState } from "react";
import { Artboard, El } from "./Artboard";
import g from "./garden.module.css";
import s from "./SgCountdown.module.css";

function left(target) {
  const ms = Math.max(0, new Date(target).getTime() - Date.now());
  return [Math.floor(ms / 86400000), Math.floor(ms / 3600000) % 24, Math.floor(ms / 60000) % 60, Math.floor(ms / 1000) % 60];
}

/** A number that slides up and out, then the new one slides up in. */
function Flip({ value }) {
  const [shown, setShown] = useState(value);
  const [phase, setPhase] = useState("");
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return undefined; }
    setPhase("out");
    let raf = 0;
    const t = window.setTimeout(() => {
      setShown(value);
      setPhase("in");
      raf = requestAnimationFrame(() => { raf = requestAnimationFrame(() => setPhase("")); });
    }, 200);
    return () => { window.clearTimeout(t); cancelAnimationFrame(raf); };
  }, [value]);
  return <span className={`${s.number} ${phase === "out" ? s.out : ""} ${phase === "in" ? s.in : ""}`}>{shown}</span>;
}

/**
 * Gold countdown: the numbers are written in as if with ink when they come into view, then shimmer
 * like candlelight; each change flips the digit. date: ISO string.
 */
export default function SgCountdown({ id = "sg-countdown", title = "The Celebration Begins In", date, labels = ["Days", "Hours", "Minutes", "Seconds"] }) {
  const box = useRef(null);
  const [now, setNow] = useState(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const tick = () => setNow(left(date));
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, [date]);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } });
    io.observe(box.current);
    return () => io.disconnect();
  }, []);
  const values = now ? now.map((v) => String(v).padStart(2, "0")) : ["--", "--", "--", "--"];

  return <Artboard id={id} height={257} mHeight={247} pt={15} pb={15} label="Countdown">
    <El x={-40} y={23} w={531} h={170} m={{ x: -10, y: 24, w: 470 }} appear={{ style: "fadeinup", dur: 1, dist: 100 }}>
      <div ref={box} className={`${s.timer} ${seen ? s.seen : ""}`} role="timer" aria-live="off">
        {labels.map((label, i) => <div key={label} className={s.unit} style={{ "--i": i }}>
          {i > 0 && <span className={s.sep} aria-hidden="true">:</span>}
          <div className={s.block}>
            <span className={s.wrap}><Flip value={values[i]} /></span>
            <span className={s.label}>{label}</span>
          </div>
        </div>)}
      </div>
    </El>
    <El x={-55} y={28} w={560} h={64}><h2 className={`${g.text} ${g.title}`}>{title}</h2></El>
  </Artboard>;
}

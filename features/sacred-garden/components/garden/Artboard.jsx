"use client";
import { useEffect } from "react";
import s from "./Artboard.module.css";

/*
  A tiny layout engine for poster-style sections: each section is a full-width band with a
  450px column in the middle, and every piece inside sits at an exact x/y/size in that column
  (x may be negative to bleed past the column). `m` holds different numbers for phones (<480px).

  Motion, set per piece:
  - appear: { style: "fadein" | "fadeinup" | "fadeinleft" | "fadeinright" | "zoomin", dur, delay, dist, scale }
    plays once when the piece scrolls into view.
  - steps: { ev: "intoview" | "blockintoview" | "scroll", trg, ofs, loop, list: [step, …] }
    a step is { mx, my, sx, sy, ro, op } plus ti (ms) and dt (delay ms) for timed events,
    or di (scroll px) for "scroll". Timed steps start when the piece (or its whole section for
    "blockintoview") passes `trg` × screen height; "scroll" steps follow the scroll position.
  Call useArtboardMotion(rootRef, active) once around all the sections.
*/

const EASE_OUT = "cubic-bezier(0.19, 1, 0.22, 1)";
const px = (v) => (v === undefined ? undefined : typeof v === "number" ? `${v}px` : v);

/**
 * One full-width band. height: px; mHeight: px on phones; auto: grow with in-flow content.
 * pt / pb: space above / below the band (same colour), outside its height.
 */
export function Artboard({ id, height, mHeight, auto = false, pt, pb, bg, label, className, children }) {
  return <section id={id} aria-label={label} className={s.rec} style={{ paddingTop: px(pt), paddingBottom: px(pb), "--bg": bg }}>
    <div data-artboard="" className={[s.board, auto && s.auto, className].filter(Boolean).join(" ")} style={{ "--h": px(height), "--mh": px(mHeight ?? height) }}>
      <div className={s.col}>{children}</div>
    </div>
  </section>;
}

const appearFrom = ({ style, dist = 100, scale = 0.9 }) => ({
  fadeinup: `translateY(${dist}px)`,
  fadeindown: `translateY(${-dist}px)`,
  fadeinleft: `translateX(${dist}px)`,
  fadeinright: `translateX(${-dist}px)`,
  zoomin: `scale(${scale})`,
}[style] ?? "none");

const stepTransform = (st) => `translate(${st.mx ?? 0}px, ${st.my ?? 0}px) rotate(${st.ro ?? 0}deg) scale(${st.sx ?? 1}, ${st.sy ?? st.sx ?? 1})`;

/** A positioned piece. x/y/w/h in px of the 450px column; m: { x, y, w, h } for phones. */
export function El({ x, y, w, h, m = {}, z, appear, steps, as: Tag = "div", className, style, children, ...rest }) {
  const vars = {
    "--x": px(x), "--y": px(y), "--w": px(w), "--eh": px(h),
    "--mx": px(m.x), "--my": px(m.y), "--mw": px(m.w), "--meh": px(m.h), "--z": z,
  };
  const motion = appear
    ? { opacity: 0, transform: appearFrom(appear) }
    : steps ? { transform: stepTransform(steps.list[0]), opacity: steps.list[0].op ?? 1, willChange: "transform, opacity" } : null;
  return <Tag className={[s.el, className].filter(Boolean).join(" ")} style={{ ...vars, ...motion, ...style }}
    data-appear={appear ? JSON.stringify(appear) : undefined} data-steps={steps ? JSON.stringify(steps) : undefined} {...rest}>
    {children}
  </Tag>;
}

function playTimed(el, { list, loop }) {
  const frames = [{ transform: stepTransform(list[0]), opacity: list[0].op ?? 1 }];
  const times = [0];
  let t = 0;
  for (let i = 1; i < list.length; i++) {
    if (list[i].dt) { t += list[i].dt; frames.push({ ...frames[frames.length - 1] }); times.push(t); }
    t += list[i].ti ?? 0;
    frames.push({ transform: stepTransform(list[i]), opacity: list[i].op ?? 1 });
    times.push(t);
  }
  if (t <= 0) return;
  frames.forEach((f, i) => { f.offset = times[i] / t; });
  el.animate(frames, { duration: t, iterations: loop ? Infinity : 1, fill: "forwards" });
}

// works for the window and for a scrolling box (e.g. a preview pane): measured from the band's live position
function applyScroll(item) {
  const { el, list, trg = 0.5, ofs = 0 } = item;
  const top = el.closest("[data-artboard]").getBoundingClientRect().top + item.offset;
  let left = window.innerHeight * trg - top - ofs;
  let cur = list[0];
  if (left > 0) {
    for (let i = 1; i < list.length; i++) {
      const di = list[i].di ?? 0;
      if (left <= di) {
        const p = di ? left / di : 1, a = list[i - 1], b = list[i];
        const lerp = (k, d) => (a[k] ?? d) + ((b[k] ?? d) - (a[k] ?? d)) * p;
        cur = { mx: lerp("mx", 0), my: lerp("my", 0), sx: lerp("sx", 1), sy: lerp("sy", 1), ro: lerp("ro", 0), op: lerp("op", 1) };
        left = -1;
        break;
      }
      left -= di;
      cur = list[i];
    }
  }
  el.style.transform = stepTransform(cur);
  el.style.opacity = cur.op ?? 1;
}

/**
 * Runs every piece's appear / steps motion inside rootRef once `active` is true.
 * content: pass the data the sections render, so pieces added later (e.g. from a form) get their motion too;
 * pieces that already appeared or started keep going and are not replayed.
 */
export function useArtboardMotion(rootRef, active = true, content) {
  useEffect(() => {
    const root = rootRef.current;
    if (!active || !root) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const show = (el) => { el.dataset.shown = ""; el.style.opacity = "1"; el.style.transform = "none"; };

    const appearing = [...root.querySelectorAll("[data-appear]:not([data-shown])")];
    if (reduce) appearing.forEach(show);
    const io = reduce ? null : new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      const { dur = 1, delay = 0 } = JSON.parse(e.target.dataset.appear);
      e.target.style.transition = `opacity ${dur}s ${EASE_OUT} ${delay}s, transform ${dur}s ${EASE_OUT} ${delay}s`;
      requestAnimationFrame(() => requestAnimationFrame(() => show(e.target)));
    }));
    if (io) appearing.forEach((el) => io.observe(el));

    const timed = [], scrolled = [];
    if (!reduce) root.querySelectorAll("[data-steps]").forEach((el) => {
      const item = { el, ...JSON.parse(el.dataset.steps) };
      if (item.ev === "scroll") scrolled.push(item);
      else if (!el.__sgStarted) timed.push(item);
    });
    // where each scroll-driven piece sits inside its band, measured without its own motion
    const measure = () => scrolled.forEach((it) => {
      it.el.style.transform = stepTransform(it.list[0]);
      it.offset = it.el.getBoundingClientRect().top - it.el.closest("[data-artboard]").getBoundingClientRect().top;
      applyScroll(it);
    });
    let frame = 0;
    const tick = () => {
      frame = 0;
      const vh = window.innerHeight;
      timed.forEach((it) => {
        if (it.el.__sgStarted) return;
        const top = it.ev === "blockintoview" ? it.el.closest("[data-artboard]").getBoundingClientRect().top : it.el.getBoundingClientRect().top;
        if (top + (it.ofs ?? 0) <= vh * (it.trg ?? 1)) { it.el.__sgStarted = true; playTimed(it.el, it); }
      });
      scrolled.forEach(applyScroll);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(tick); };
    const onResize = () => { measure(); onScroll(); };
    measure();
    tick();
    // capture: also hears scrolling inside boxes, not only the window
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("load", onResize);
    return () => {
      io?.disconnect();
      cancelAnimationFrame(frame);
      document.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", onResize);
      window.removeEventListener("load", onResize);
    };
  }, [rootRef, active, content]);
}

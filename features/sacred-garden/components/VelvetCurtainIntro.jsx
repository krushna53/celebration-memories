"use client";
import { useEffect, useRef } from "react";
import s from "./VelvetCurtainIntro.module.css";
import { useT } from "./i18n";

/*
 * A stage curtain drawn on a canvas so the fabric can really move:
 *  - each drape is made of vertical folds (light crest, dark valley) that squeeze together as it gathers,
 *  - the top (on the rod) moves first and the hem trails behind, so the leading edge sweeps in a curve,
 *  - while it moves the edge and folds ripple, then settle into a gentle idle sway,
 *  - when fully open each drape is tied back at 60% height (hourglass shape) with a gold tassel.
 * The page behind shows through as the curtain opens.
 */

const OPEN_MS = 2600;
const OPEN_AT = 0.3;   // dragged past 30% → opens fully; otherwise falls back closed
const LAG = 0.28;      // how far the hem trails the rod
const FOLD_PX = 64;    // one fold in the prerendered strip
const STRIP_FOLDS = 16;
const ROW = 4;         // px per drawn row

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (v) => v * v * (3 - 2 * v);
const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

function canvasOf(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")];
}

// fixed pseudo-random 0..1 per fold, so every strip has the same uneven folds and layers line up
const rand = (i) => { const v = Math.sin(i * 12.9898 + 4.1) * 43758.5453; return v - Math.floor(v); };

/** One row of folds: crest → soft roll into a sharper shadow → crest. Folds vary in width and depth. */
function makeStrip(valley, crest, sheen) {
  const [c, ctx] = canvasOf(FOLD_PX * STRIP_FOLDS, 1);
  const img = ctx.createImageData(c.width, 1);
  const widths = Array.from({ length: STRIP_FOLDS }, (_, i) => 0.7 + 0.6 * rand(i));
  const scale = c.width / widths.reduce((a, b) => a + b, 0);
  let start = 0, fold = 0;
  for (let x = 0; x < c.width; x++) {
    while (fold < STRIP_FOLDS - 1 && x >= start + widths[fold] * scale) { start += widths[fold] * scale; fold++; }
    const f = (x - start) / (widths[fold] * scale);
    const depth = 0.75 + 0.25 * rand(fold + 31);
    const u = f < 0.6 ? (f / 0.6) * 0.5 : 0.5 + ((f - 0.6) / 0.4) * 0.5; // asymmetric fold
    const lit = 1 - depth + depth * Math.pow(0.5 + 0.5 * Math.cos(2 * Math.PI * u), 0.85);
    const shine = Math.pow(lit, 14) * sheen;
    for (let i = 0; i < 3; i++) img.data[x * 4 + i] = Math.min(255, valley[i] + (crest[i] - valley[i]) * lit + 255 * shine);
    img.data[x * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function makeShadow() {
  const [c, ctx] = canvasOf(32, 1);
  const g = ctx.createLinearGradient(0, 0, 32, 0);
  g.addColorStop(0, "rgba(60,40,10,0.32)");
  g.addColorStop(1, "rgba(60,40,10,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 1);
  return c;
}

function makePearl() {
  const [c, ctx] = canvasOf(12, 12);
  const g = ctx.createRadialGradient(4.5, 4.5, 0.5, 6, 6, 5);
  g.addColorStop(0, "#fffef8");
  g.addColorStop(0.55, "#efe3c3");
  g.addColorStop(1, "#a88a4f");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(6, 6, 4.6, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

function makeTassel() {
  const [c, ctx] = canvasOf(24, 84);
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = i % 2 ? "#b8913d" : "#e6c77e";
    ctx.fillRect(2 + i * 2, 16, 2, 62 + (i % 3) * 3);
  }
  const cap = ctx.createRadialGradient(9, 7, 1, 12, 9, 10);
  cap.addColorStop(0, "#fff3c4");
  cap.addColorStop(0.6, "#d6ad55");
  cap.addColorStop(1, "#7a5b1c");
  ctx.fillStyle = cap;
  ctx.beginPath();
  ctx.ellipse(12, 10, 10, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

/** Draws one drape anchored at x = 0 (the right drape is drawn mirrored). Returns its rows. */
function drawSide(ctx, W, H, g, t, motion, art, reduced, seed) {
  const folds = Math.max(6, Math.min(14, Math.round(W / 140) + 4));
  const openBase = W < 600 ? 0.17 : 0.12;
  const rows = [];
  for (let y = 0; y < H + ROW; y += ROW) {
    const yn = Math.min(1, y / H);
    const local = smooth(clamp01(g * (1 + LAG) - LAG * yn));
    const bump = Math.exp(-(((yn - 0.6) / 0.1) ** 2)); // narrow where it is tied
    const below = Math.max(0, (yn - 0.6) / 0.4);       // flares out under the tie
    const openRow = openBase * (1 + 0.8 * below) * (1 - 0.5 * bump);
    const tt = t + seed;
    const wave = reduced ? 0 : 12 * motion * Math.sin(2 * Math.PI * yn * 1.1 - tt * 5.5) + 2.5 * Math.sin(tt * 1.1 + yn * 4);
    const edge = Math.max(8, (0.505 + (openRow - 0.505) * local) * W + wave);
    const phase = reduced ? 0 : 0.3 * motion * Math.sin(2 * Math.PI * yn * 0.9 - tt * 5) + 0.06 * Math.sin(tt * 1.2 + yn * 2.5);
    rows.push({ y, edge, local });
    const sx = (1 + phase) * FOLD_PX;
    ctx.drawImage(art.base, sx, 0, folds * FOLD_PX, 1, 0, y, edge, ROW + 0.6);
    if (local > 0.01) {
      ctx.globalAlpha = local * 0.6; // gathered folds get deeper
      ctx.drawImage(art.deep, sx, 0, folds * FOLD_PX, 1, 0, y, edge, ROW + 0.6);
      ctx.globalAlpha = 1;
    }
  }
  return rows;
}

function drawDetails(ctx, H, rows, art) {
  // soft shadow cast behind the leading edge
  ctx.globalCompositeOperation = "destination-over";
  for (const r of rows) ctx.drawImage(art.shadow, 0, 0, 32, 1, r.edge - 2, r.y, 40, ROW); // exact height: overlapping rows would stripe
  ctx.globalCompositeOperation = "source-over";
  // gold trim and pearls down the leading edge
  ctx.fillStyle = "#c9a052";
  for (const r of rows) ctx.fillRect(r.edge - 3, r.y, 3, ROW + 0.6);
  for (let i = 2; i < rows.length; i += 5) ctx.drawImage(art.pearl, rows[i].edge - 15, rows[i].y - 6);
  // tieback appears as the drape settles
  const tie = rows[Math.min(rows.length - 1, Math.round((0.6 * H) / ROW))];
  const a = smooth(clamp01((tie.local - 0.7) / 0.3));
  if (a > 0) {
    ctx.globalAlpha = a;
    const band = ctx.createLinearGradient(0, tie.y - 5, 0, tie.y + 5);
    band.addColorStop(0, "#f5dd9a");
    band.addColorStop(0.5, "#c9a052");
    band.addColorStop(1, "#7d5d22");
    ctx.fillStyle = band;
    ctx.fillRect(0, tie.y - 5, tie.edge + 4, 10);
    ctx.drawImage(art.tassel, tie.edge - 14, tie.y + 2);
    ctx.globalAlpha = 1;
  }
}

function draw(ctx, W, H, g, t, motion, art, reduced) {
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  const left = drawSide(ctx, W, H, g, t, motion, art, reduced, 0);
  ctx.restore();
  ctx.save();
  ctx.translate(W, 0);
  ctx.scale(-1, 1);
  const right = drawSide(ctx, W, H, g, t, motion, art, reduced, 1.7);
  ctx.restore();

  // lighting, heading tape and hem braid, painted only onto the fabric
  ctx.globalCompositeOperation = "source-atop";
  const light = ctx.createLinearGradient(0, 0, 0, H);
  light.addColorStop(0, "rgba(255,255,255,0.18)");
  light.addColorStop(0.45, "rgba(255,255,255,0)");
  light.addColorStop(1, "rgba(70,45,15,0.26)");
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(0, 0, W, 42);
  ctx.fillStyle = "rgba(120,90,40,0.28)";
  ctx.fillRect(0, 42, W, 1.5);
  const hem = ctx.createLinearGradient(0, H - 16, 0, H);
  hem.addColorStop(0, "#f2d98e");
  hem.addColorStop(0.5, "#c9a052");
  hem.addColorStop(1, "#8a6a2a");
  ctx.fillStyle = hem;
  ctx.fillRect(0, H - 16, W, 16);
  ctx.globalCompositeOperation = "source-over";

  ctx.save();
  drawDetails(ctx, H, left, art);
  ctx.restore();
  ctx.save();
  ctx.translate(W, 0);
  ctx.scale(-1, 1);
  drawDetails(ctx, H, right, art);
  ctx.restore();
}

/**
 * Tap the plaque, tap anywhere, or drag sideways to open. onOpen runs on the first interaction
 * (so music can start); onDone runs once the curtain is open.
 */
export default function VelvetCurtainIntro({ names = "", tapLabel, onOpen, onDone }) {
  const t = useT();
  const label = tapLabel ?? t("tapToOpen");
  const stage = useRef(null);
  const canvas = useRef(null);
  const st = useRef({ g: 0, anim: null, drag: null, opened: false, motion: 0, lastG: 0, lastT: 0, finishedAt: 0 });
  const cb = useRef({ onOpen, onDone });
  cb.current = { onOpen, onDone };

  useEffect(() => {
    const el = canvas.current;
    const ctx = el.getContext("2d");
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const art = {
      base: makeStrip([192, 168, 124], [250, 243, 224], 0.16),
      deep: makeStrip([142, 114, 72], [255, 248, 230], 0.24),
      shadow: makeShadow(),
      pearl: makePearl(),
      tassel: makeTassel(),
    };
    let W = 0, H = 0, raf = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      el.width = Math.round(W * dpr);
      el.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const frame = (now) => {
      const s = st.current;
      if (s.anim) {
        const k = clamp01((now - s.anim.start) / s.anim.dur);
        s.g = s.anim.from + (s.anim.to - s.anim.from) * easeInOut(k);
        if (k >= 1) { const done = s.anim.done; s.anim = null; done?.(); }
      }
      const dt = Math.max(1, now - (s.lastT || now)) / 1000;
      const speed = Math.abs(s.g - s.lastG) / dt;
      s.lastG = s.g;
      s.lastT = now;
      s.motion += (Math.min(1, speed * 1.4) - s.motion) * 0.08; // rises while moving, settles after
      stage.current?.style.setProperty("--p", s.g.toFixed(3));
      draw(ctx, W, H, s.g, now / 1000, s.motion, art, reduced);
      if (s.finishedAt && now - s.finishedAt > 1200) return; // faded out: stop drawing
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  const animateTo = (to, dur, done) => {
    const s = st.current;
    s.anim = { from: s.g, to, start: performance.now(), dur, done };
  };

  const open = () => {
    const s = st.current;
    if (s.opened) return;
    s.opened = true;
    s.drag = null;
    if (stage.current) stage.current.dataset.phase = "opening";
    cb.current.onOpen?.();
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    animateTo(1, reduced ? 700 : OPEN_MS * (1 - s.g * 0.5), () => {
      if (stage.current) stage.current.dataset.phase = "open";
      s.finishedAt = performance.now();
      cb.current.onDone?.();
    });
  };

  const onPointerDown = (e) => {
    const s = st.current;
    if (s.opened) return;
    s.anim = null;
    s.drag = { x: e.clientX, moved: false, g0: s.g };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    const s = st.current;
    const d = s.drag;
    if (!d || s.opened) return;
    const dx = Math.abs(e.clientX - d.x);
    if (!d.moved && dx < 8) return; // small jitter is still a tap
    d.moved = true;
    s.g = clamp01(d.g0 + dx / (window.innerWidth * 0.45));
    if (stage.current) stage.current.dataset.phase = "dragging";
  };

  const onPointerUp = () => {
    const s = st.current;
    const d = s.drag;
    s.drag = null;
    if (!d || s.opened) return;
    if (!d.moved) return open();
    if (s.g >= OPEN_AT) return open();
    if (stage.current) stage.current.dataset.phase = "idle";
    animateTo(0, 600);
  };

  return <div
    ref={stage}
    className={s.stage}
    data-phase="idle"
    onPointerDown={onPointerDown}
    onPointerMove={onPointerMove}
    onPointerUp={onPointerUp}
    onPointerCancel={onPointerUp}
  >
    <div className={s.wall} aria-hidden="true" />
    <canvas ref={canvas} className={s.canvas} aria-hidden="true" />
    <span className={s.rod} aria-hidden="true" />

    <div className={s.copy}>
      {names && <>
        <p className={s.kicker}>{t("gettingMarried")}</p>
        <p className={s.names}>{names}</p>
      </>}
    </div>

    <div className={s.center}>
      <button type="button" className={s.plaque} onClick={open} aria-label={`${label} the invitation`}>
        <span className={s.label}>{label}</span>
        <span className={s.arrows} aria-hidden="true">⟵ &nbsp;&nbsp; ⟶</span>
      </button>
    </div>
  </div>;
}

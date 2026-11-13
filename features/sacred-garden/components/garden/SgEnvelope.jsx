"use client";
import { useEffect, useRef, useState } from "react";
import s from "./SgEnvelope.module.css";

/*
  Opening screen: the envelope film waits on its first frame with "Tap to open". On tap (or by itself, see
  autoOpen) it plays full screen with the music and slowly fades out, drifting closer, just before it ends to
  reveal the page; then a round play / pause button for the music appears. The music pauses while the guest
  is away from the page (another tab or app, screen locked) and carries on when they come back.

  theme: CSS variables (e.g. the couple's --sg-button colour) for the music button.
  monogram + sealTrack: paints the couple's letters on the film's wax seal. sealTrack lists, for moments
  of the film, where the seal is: [time s, centre x, centre y, radius x, radius y, strength] with x, y and
  radii as parts of the film's width / height (see envelope-track.js). The seal's own colours are read
  from each frame, so the letters glow along with the seal.
*/

const SCRIPT = '"Pinyon Script", "Great Vibes", cursive';

/** seal position at time t, blended between the two nearest samples */
function sealAt(track, t) {
  let i = 0;
  while (i < track.length - 2 && track[i + 1][0] <= t) i++;
  const a = track[i], b = track[i + 1] ?? a;
  if (a[1] == null || b[1] == null) return a[1] == null ? null : a;
  const k = b[0] > a[0] ? Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0]))) : 0;
  return a.map((v, j) => v + (b[j] - v) * k);
}

/** average colour of the pixels that pass `keep` inside a ring of the sample image */
function ringColour(px, w, h, cx, cy, rx, ry, r0, r1, keep) {
  let r = 0, g = 0, b = 0, n = 0;
  for (let a = 0; a < 360; a += 6) for (let f = r0; f <= r1; f += 0.04) {
    const x = Math.round(cx + Math.cos(a * Math.PI / 180) * rx * f), y = Math.round(cy + Math.sin(a * Math.PI / 180) * ry * f);
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const i = (y * w + x) * 4;
    if (!keep(px[i], px[i + 1], px[i + 2])) continue;
    r += px[i]; g += px[i + 1]; b += px[i + 2]; n++;
  }
  return n ? [r / n, g / n, b / n] : null;
}

const rgb = ([r, g, b], k = 1, a = 1) => `rgba(${Math.min(255, r * k) | 0}, ${Math.min(255, g * k) | 0}, ${Math.min(255, b * k) | 0}, ${a})`;

/** resolves once the monogram's script font can be drawn on a canvas */
export const sealFontReady = () => document.fonts?.load(`64px ${SCRIPT}`).catch(() => {}) ?? Promise.resolve();

// A seal close-up is a square around the seal, SEAL_CROP seal-radii from the centre to each side.
export const SEAL_CROP = 1.35;

/** Square close-up (size × size) of the seal in the film's current frame, for Grok to re-letter. */
export function sealCloseUp(film, sealTrack, size = 768) {
  const seal = sealAt(sealTrack, film.currentTime);
  if (!seal) throw new Error("The seal is not visible in this frame.");
  const [, fx, fy, frx] = seal;
  const W = film.videoWidth, H = film.videoHeight, half = SEAL_CROP * frx * W;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  canvas.getContext("2d").drawImage(film, fx * W - half, fy * H - half, half * 2, half * 2, 0, 0, size, size);
  return canvas;
}

/**
 * The face of a re-lettered seal close-up (an image or canvas), cut to the pressed inner disc with a soft
 * edge, so it can be laid over the film's seal while the film's own wax rim stays visible.
 */
export function sealFace(image, size = 512) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const x = c.getContext("2d");
  x.drawImage(image, 0, 0, size, size);
  const r = size / 2 / SEAL_CROP; // the seal's radius in this square
  const fade = x.createRadialGradient(size / 2, size / 2, r * 0.62, size / 2, size / 2, r * 0.74);
  fade.addColorStop(0, "#000");
  fade.addColorStop(1, "rgba(0, 0, 0, 0)");
  x.globalCompositeOperation = "destination-in";
  x.fillStyle = fade;
  x.fillRect(0, 0, size, size);
  return c;
}

/**
 * Lays `face` (from sealFace) over the film's seal at the film's current time, following its position, size,
 * tilt and fade, and brightening it as the film's wax glows. `state.wax0` keeps the closed seal's wax colour.
 */
export function paintSealFace(x, w, h, film, sx, sealTrack, face, state) {
  const seal = sealAt(sealTrack, film.currentTime);
  if (!seal) return false;
  const [, fx, fy, frx, fry, strength] = seal;
  const sw = sx.canvas.width, sh = sx.canvas.height;
  sx.drawImage(film, 0, 0, sw, sh);
  const px = sx.getImageData(0, 0, sw, sh).data;
  const wax = ringColour(px, sw, sh, fx * sw, fy * sh, frx * sw, fry * sw, 0.6, 0.74, (r, g, b) => r - g > 40 && r - b > 30);
  if (!state.wax0 && wax && film.currentTime < 0.3) state.wax0 = wax;
  // the light the film's seal has gained since it was closed is added to the face, so both glow alike
  const add = wax && state.wax0 ? wax.map((v, i) => Math.max(0, v - state.wax0[i])) : [0, 0, 0];
  let lit = face;
  if (add.some((v) => v > 1)) {
    const t = state.tmp ?? (state.tmp = Object.assign(document.createElement("canvas"), { width: face.width, height: face.height }));
    const tx = t.getContext("2d");
    tx.globalCompositeOperation = "copy"; tx.drawImage(face, 0, 0);
    tx.globalCompositeOperation = "lighter"; tx.fillStyle = rgb(add); tx.fillRect(0, 0, t.width, t.height);
    tx.globalCompositeOperation = "destination-in"; tx.drawImage(face, 0, 0); // keep the face's soft round edge
    lit = t;
  }
  const rx = frx * w, ry = fry * w;
  x.save();
  x.globalAlpha = Math.min(1, strength / (sealTrack[0][5] || strength));
  x.drawImage(lit, fx * w - SEAL_CROP * rx, fy * h - SEAL_CROP * ry, 2 * SEAL_CROP * rx, 2 * SEAL_CROP * ry);
  x.restore();
  return true;
}

/**
 * Paints `monogram` ("A & M") over the film's wax seal at the film's current time, on a canvas context `x`
 * of size w × h that covers the film. Colours are read from the film frame through `sx`, a small canvas
 * context used as a sampler. Returns false when the seal is not on screen.
 */
export function paintSeal(x, w, h, film, sx, sealTrack, monogram) {
  const seal = sealAt(sealTrack, film.currentTime);
  if (!seal) return false;
  const [first, second] = monogram.split("&").map((p) => p.trim());
  const [, fx, fy, frx, fry, strength] = seal;
  const sw = sx.canvas.width, sh = sx.canvas.height;
  // read the seal's wax and gold from this very frame
  sx.drawImage(film, 0, 0, sw, sh);
  const px = sx.getImageData(0, 0, sw, sh).data;
  const scx = fx * sw, scy = fy * sh, srx = frx * sw, sry = fry * sw;
  const wax = ringColour(px, sw, sh, scx, scy, srx, sry, 0.6, 0.74, (r, g, b) => r - g > 40 && r - b > 30);
  const gold = ringColour(px, sw, sh, scx, scy, srx, sry, 0.05, 0.5, (r, g, b) => r > 150 && g > 100 && r - b > 40);
  if (!wax) return false;
  const cx = fx * w, cy = fy * h, rx = frx * w, ry = fry * w;
  x.save();
  x.globalAlpha = Math.min(1, strength / (sealTrack[0][5] || strength));
  x.translate(cx, cy);
  x.scale(1, ry / rx);
  // cover the film's letters with the seal's own wax, feathered into the pressed ring
  const fill = x.createRadialGradient(0, -rx * 0.12, rx * 0.05, 0, 0, rx * 0.62);
  fill.addColorStop(0, rgb(wax, 1.12));
  fill.addColorStop(0.78, rgb(wax, 1));
  fill.addColorStop(1, rgb(wax, 1, 0));
  x.fillStyle = fill;
  x.beginPath(); x.arc(0, 0, rx * 0.62, 0, Math.PI * 2); x.fill();
  // the couple's letters, pressed into the wax
  const g = gold ?? [214, 176, 108];
  const size = rx * 0.7;
  x.font = `${size}px ${SCRIPT}`;
  x.textBaseline = "middle";
  const smallFont = `${size * 0.6}px ${SCRIPT}`;
  const parts = [[first, x.font], [second ? "&" : "", smallFont], [second ?? "", x.font]];
  const widths = parts.map(([t, font]) => { x.font = font; return x.measureText(t).width; });
  let left = -(widths[0] + widths[1] * 0.8 + widths[2]) / 2;
  parts.forEach(([t, font], i) => {
    x.font = font;
    const dy = i === 1 ? size * 0.12 : 0;
    // a dark edge below, then the gold letter drawn with a fine outline so it reads as thick as the film's
    x.lineJoin = "round";
    x.lineWidth = size * 0.05;
    x.strokeStyle = "rgba(40, 6, 8, 0.5)"; x.strokeText(t, left + size * 0.02, dy + size * 0.045);
    x.fillStyle = "rgba(40, 6, 8, 0.55)"; x.fillText(t, left + size * 0.02, dy + size * 0.045);
    const shine = x.createLinearGradient(0, -size / 2, 0, size / 2);
    shine.addColorStop(0, rgb(g, 1.2)); shine.addColorStop(0.55, rgb(g, 1)); shine.addColorStop(1, rgb(g, 0.82));
    x.lineWidth = size * 0.035;
    x.strokeStyle = shine; x.strokeText(t, left, dy);
    x.fillStyle = shine; x.fillText(t, left, dy);
    left += widths[i] * (i === 1 ? 0.8 : 1) - (i === 0 ? size * 0.06 : 0);
  });
  x.restore();
  return true;
}

// screens that get the wide (16:9) opening video, when there is one
const WIDE = "(min-width: 768px) and (orientation: landscape)";

/**
 * sealImage: a re-lettered seal close-up (see sealCloseUp), e.g. from Grok; laid over the seal instead of painted letters.
 * desktopVideo: a wide (16:9) video played instead of `video` on computer screens; no letters are painted on it.
 * autoOpen: seconds after which the envelope opens by itself (0 = wait for a tap).
 * Music: tried as the page loads and again at any sign of the guest (hover, focus, scroll, swipe, key, tap), so it starts
 *   the moment the browser allows. Phones allow sound only after a tap or key press (not a hover, scroll or swipe); until
 *   then the opened page's music button pulses with "Tap for music".
 * onMusic(on): told whenever the music starts or stops (the page's auto-scroll follows it).
 */
export default function SgEnvelope({ video, desktopVideo, music, tapLabel = "Tap to open", monogram, sealTrack, sealImage, autoOpen = 0, theme, onOpen, onDone, onMusic }) {
  const [phase, setPhase] = useState("closed"); // closed → playing → leaving → done
  const [playing, setPlaying] = useState(false);
  const [overForm, setOverForm] = useState(false);
  const [needsTap, setNeedsTap] = useState(false); // the browser held the music back until the guest taps
  const told = useRef(onMusic);
  told.current = onMusic;
  useEffect(() => { told.current?.(playing); }, [playing]);
  const [wideScreen, setWideScreen] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(WIDE);
    const update = () => setWideScreen(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const wide = wideScreen && Boolean(desktopVideo) && desktopVideo !== video;
  // our own wide envelope films fill the whole screen; a couple's own wide video is shown whole
  const fill = wide && desktopVideo.startsWith("/invite-art/");
  // the seal track belongs to our envelope film, never to the couple's wide video
  const track = wide ? null : sealTrack;
  const film = useRef(null);
  // the opening video's own shape (width / height); the box takes it so the video fills it with no side bands
  const [ratio, setRatio] = useState(null);
  const readRatio = () => {
    const v = film.current;
    if (v?.videoWidth && v.videoHeight) setRatio(v.videoWidth / v.videoHeight);
  };
  // the video may already know its size before React listens (e.g. from the cache)
  useEffect(readRatio, [wide, video, desktopVideo]);
  const paint = useRef(null);
  const audio = useRef(null);
  const ended = useRef(false);
  const userPaused = useRef(false); // the guest paused the music themselves; nothing starts it again but the play button

  const finish = () => {
    if (ended.current) return;
    ended.current = true;
    setPhase("leaving");
    window.setTimeout(() => { setPhase("done"); onDone?.(); }, 1800);
  };
  // auto: opened by the timer, not a tap. A phone that refuses to play the film by itself (e.g. iPhone Low Power
  // Mode) then keeps the envelope waiting for a tap instead of cutting straight to the page.
  const open = (auto) => {
    if (phase !== "closed") return;
    setPhase("playing");
    onOpen?.();
    if (film.current) film.current.play()?.catch(auto === true ? () => setPhase("closed") : finish);
    else finish();
    if (audio.current && audio.current.paused && !userPaused.current) {
      audio.current.volume = 1;
      audio.current.play()?.then(() => setPlaying(true)).catch(() => setNeedsTap(true));
    }
  };
  const onTime = () => {
    const v = film.current;
    if (v?.duration && v.currentTime >= v.duration - 1.2) finish();
  };
  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    setNeedsTap(false);
    userPaused.current = !a.paused;
    if (a.paused) a.play()?.then(() => setPlaying(true)).catch(() => {});
    else { a.pause(); setPlaying(false); }
  };

  // the music pauses while the guest is away from the page and picks up again when they return
  useEffect(() => {
    if (!music) return undefined;
    let resume = false;
    const onVisibility = () => {
      const a = audio.current;
      if (!a) return;
      if (document.hidden) { resume = !a.paused; if (resume) a.pause(); }
      else if (resume) { resume = false; a.play()?.catch(() => setPlaying(false)); }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [music]);

  // the music button steps aside while the RSVP form is on screen, so it never covers a field or link
  useEffect(() => {
    const form = document.getElementById("rsvp");
    if (!form || !music) return undefined;
    const seen = new IntersectionObserver(([e]) => setOverForm(e.isIntersecting), { threshold: 0.15 });
    seen.observe(form);
    return () => seen.disconnect();
  }, [music, phase]);

  // the envelope opens by itself after `autoOpen` seconds, unless the guest taps first
  useEffect(() => {
    if (!autoOpen || phase !== "closed") return undefined;
    const timer = window.setTimeout(() => open(true), autoOpen * 1000);
    return () => window.clearTimeout(timer);
  });

  // the music starts as soon as the browser lets it: on load, then at any sign of the guest (a few tries a second at most)
  useEffect(() => {
    if (!music || playing) return undefined;
    let lastTry = 0;
    const start = () => {
      const a = audio.current, now = Date.now();
      if (!a || !a.paused || userPaused.current || now - lastTry < 300) return;
      lastTry = now;
      a.play()?.then(() => { setPlaying(true); setNeedsTap(false); }).catch(() => {});
    };
    start();
    ACTIVITY.forEach((type) => window.addEventListener(type, start, { capture: true, passive: true }));
    return () => ACTIVITY.forEach((type) => window.removeEventListener(type, start, true));
  }, [music, playing]);

  // put the couple's letters on the seal, frame by frame: Grok's seal face when there is one, else painted letters
  useEffect(() => {
    const v = film.current, c = paint.current;
    if (!v || !c || !(monogram || sealImage) || !track?.length || phase === "done") return undefined;
    const sample = document.createElement("canvas");
    sample.width = 180; sample.height = 320;
    const sx = sample.getContext("2d", { willReadFrequently: true });
    const x = c.getContext("2d");
    let raf = 0, stopped = false, fontReady = false, face = null;
    const state = {};
    sealFontReady().then(() => { fontReady = true; });
    if (sealImage) {
      const img = new Image();
      img.onload = () => { if (!stopped) face = sealFace(img); };
      img.src = sealImage;
    }

    const draw = () => {
      if (stopped) return;
      raf = requestAnimationFrame(draw);
      const box = c.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (c.width !== Math.round(box.width * dpr)) { c.width = Math.round(box.width * dpr); c.height = Math.round(box.height * dpr); }
      x.clearRect(0, 0, c.width, c.height);
      if (v.readyState < 2) return;
      if (sealImage) { if (face) paintSealFace(x, c.width, c.height, v, sx, track, face, state); }
      else if (fontReady) paintSeal(x, c.width, c.height, v, sx, track, monogram);
    };
    draw();
    return () => { stopped = true; cancelAnimationFrame(raf); };
  }, [monogram, sealImage, track, phase]);

  return <>
    {music && <audio ref={audio} src={music} loop preload="auto" />}
    {phase !== "done" && <div className={`${s.stage} ${phase === "leaving" ? s.out : ""}`} onClick={open}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }} role="button" tabIndex={0} aria-label={tapLabel}>
      <div className={`${s.box} ${wide ? s.wide : ""} ${fill ? s.fill : ""}`} style={ratio && !fill ? { "--ar": ratio } : undefined}>
        <video ref={film} className={s.film} src={wide ? desktopVideo : video} muted playsInline preload="auto" onTimeUpdate={onTime} onEnded={finish} onLoadedMetadata={readRatio}
          onError={phase === "playing" ? finish : undefined} aria-label="Open your invitation" />
        {(monogram || sealImage) && track && <canvas ref={paint} className={s.paint} aria-hidden="true" />}
      </div>
      {phase !== "leaving" && <div className={`${s.tap} ${phase === "playing" ? s.tapGone : ""}`}><i className={s.chev} aria-hidden="true" /><span>{tapLabel}</span></div>}
    </div>}
    {music && phase === "done" && <button type="button" className={`${s.audio} ${overForm ? s.away : ""} ${needsTap && !playing ? s.waiting : ""}`} style={theme} onClick={toggle} aria-label={playing ? "Pause music" : "Play music"}>
      {playing
        ? <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
        : <svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="5,3 19,12 5,21" /></svg>}
    </button>}
    {music && phase === "done" && needsTap && !playing && !overForm && <span className={s.hint} aria-hidden="true">Tap for music</span>}
  </>;
}

// what counts as the guest being there; browsers only let sound start on some of these (a tap, click or key press)
const ACTIVITY = ["pointerdown", "pointerup", "touchstart", "touchend", "touchmove", "click", "keydown", "mousemove", "focusin", "wheel", "scroll"];

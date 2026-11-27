"use client";
// Guided spotlight tour of the "Create AI video" tab (/ai-reel). Same look and card positioning as the admin
// dashboard tour (features/admin/tour/admin-tour-controller.tsx, lib/tour-position.ts), but for visitors: it plays
// once per browser (localStorage) the first time the tab opens, and "Take the tour" replays it anytime.
// Each step points at an element tagged data-tour="…" in ai-video-studio.jsx / AiVideoSetup.jsx / AiWeddingScenes.jsx;
// a step whose element isn't on the page right now is skipped.
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Compass, X } from "lucide-react";
import { tourPosition } from "@/lib/tour-position";

const SEEN_KEY = "everymoment-ai-video-tour-v1";
const PADDING = 8;

export const AI_VIDEO_TOUR_STEPS = [
  { target: "ai-photo", title: "1. Upload your couple photo", description: "Start here. A clear photo with both of you facing the camera works best. It becomes the first frame of your film. Uploading is free." },
  { target: "ai-names", title: "2. Your names", description: "The bride's and groom's names shown in your reel's lettering. You can change them anytime, even after the video is made." },
  { target: "ai-style", title: "3. Wedding style and film part", description: "Pick your wedding tradition and which part of the celebration this film covers. The ceremonies below change to match." },
  { target: "ai-scenes", title: "4. Your ceremony scenes", description: "Each ceremony is one scene. Tap a scene to open and edit it, drag the ⠿ handle to change the order, or tap the bin to remove it. Every scene goes into the same film." },
  { target: "ai-settings", title: "5. Video settings", description: "Choose the video quality and length. The estimated credits update as you change these." },
  { target: "ai-generate", title: "6. Review and generate", description: "Check the estimated credits first. Nothing is generated until you confirm, and you can create one AI film with all your scenes in it." },
  { target: "ai-preview", title: "7. Phone preview and reel finishing", description: "Your film plays here in a phone frame. Add names, dates and venues on top, pick the lettering, then download a 9:16 MP4 for WhatsApp and Instagram." },
  { target: "ai-music", title: "8. Music", description: "Add built-in music or your own song. It plays in the preview and the downloaded reel, and uses no credits." },
];

const findTarget = (target) => {
  for (const el of document.querySelectorAll(`[data-tour="${target}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
};

export default function AiVideoTour({ steps = AI_VIDEO_TOUR_STEPS, autoStart = true }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState(steps);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [viewport, setViewport] = useState({ width: 360, height: 640, cardHeight: 260 });
  const dialogRef = useRef(null);
  const nextRef = useRef(null);
  const triggerRef = useRef(null);

  const start = useCallback(() => {
    // only steps whose part of the page is showing right now
    const present = steps.filter((s) => findTarget(s.target));
    if (!present.length) return;
    setList(present);
    setIndex(0);
    setOpen(true);
  }, [steps]);

  // First visit to the tab: play once, after the studio has drawn itself.
  useEffect(() => {
    if (!autoStart) return;
    let seen = true;
    try { seen = localStorage.getItem(SEEN_KEY) === "1"; } catch { /* storage blocked: don't auto-play */ }
    if (seen) return;
    const t = setTimeout(start, 900);
    return () => clearTimeout(t);
  }, [autoStart, start]);

  const step = list[index];

  const measure = useCallback(() => {
    setViewport({ width: window.innerWidth, height: window.innerHeight, cardHeight: dialogRef.current?.offsetHeight ?? 260 });
    const el = step ? findTarget(step.target) : null;
    if (!el) return setRect(null);
    const r = el.getBoundingClientRect();
    // a tall section (the scene list, the preview column): spotlight only the part on screen
    const top = Math.max(r.top, 0), bottom = Math.min(r.bottom, window.innerHeight);
    if (bottom <= top || r.right <= 0 || r.left >= window.innerWidth) return setRect(null);
    setRect({ top: top - PADDING, left: r.left - PADDING, width: r.width + PADDING * 2, height: bottom - top + PADDING * 2 });
  }, [step]);

  useEffect(() => {
    if (!open || !step) return;
    const el = findTarget(step.target);
    el?.scrollIntoView({ behavior: "smooth", block: el.getBoundingClientRect().height > window.innerHeight * 0.7 ? "start" : "center" });
    measure();
    const t1 = setTimeout(measure, 350), t2 = setTimeout(measure, 800);
    nextRef.current?.focus({ preventScroll: true });
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    const observer = new ResizeObserver(measure);
    if (dialogRef.current) observer.observe(dialogRef.current);
    if (el) observer.observe(el);
    return () => { clearTimeout(t1); clearTimeout(t2); window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); observer.disconnect(); };
  }, [open, step, measure]);

  const finish = useCallback(() => {
    setOpen(false);
    try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* storage blocked */ }
    triggerRef.current?.focus({ preventScroll: true });
  }, []);
  const next = useCallback(() => (index < list.length - 1 ? setIndex(index + 1) : finish()), [index, list.length, finish]);
  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Tab") {
        const controls = dialogRef.current?.querySelectorAll("button:not([disabled])");
        if (controls?.length) {
          const first = controls[0], last = controls[controls.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
      if (e.key === "Escape") { e.preventDefault(); finish(); }
      if (e.key === "ArrowRight") { e.preventDefault(); next(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); back(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, next, back, finish]);

  const position = tourPosition(rect, viewport.width, viewport.height, viewport.cardHeight);
  const isLast = index === list.length - 1;

  return (
    <>
      <button type="button" ref={triggerRef} className="ai-tour-trigger" onClick={start}>
        <Compass size={15} aria-hidden="true" /> Take the tour
      </button>
      {open && step
        ? createPortal(
            <div className="fixed inset-0 z-[2147483000]" role="presentation">
              {!rect ? <div className="absolute inset-0 bg-black/60" /> : <div className="absolute inset-0" />}
              {rect ? (
                <div
                  className="pointer-events-none fixed rounded-2xl border-2 border-gold-400 shadow-[0_0_0_9999px_rgba(10,15,30,0.62)] transition-all duration-300 ease-out"
                  style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
                />
              ) : null}
              <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-label={step.title}
                aria-live="polite"
                className="fixed overflow-y-auto rounded-xl border border-navy-950/10 bg-white p-5 text-left shadow-2xl transition-all duration-300 ease-out"
                style={position}
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-display text-base text-navy-950">{step.title}</h2>
                  <button type="button" onClick={finish} aria-label="Close tour" className="shrink-0 text-navy-700/40 hover:text-navy-700/70">
                    <X size={16} />
                  </button>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-navy-700/80">{step.description}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-navy-700/45">Step {index + 1} of {list.length}</span>
                  <div className="flex items-center gap-2">
                    {index > 0 ? (
                      <button type="button" onClick={back} className="flex items-center gap-1 rounded-lg border border-navy-950/15 px-3 py-1.5 text-xs font-medium text-navy-700/70 hover:border-navy-950/30">
                        <ArrowLeft size={13} /> Back
                      </button>
                    ) : null}
                    <button type="button" ref={nextRef} onClick={next} className="flex items-center gap-1 rounded-lg bg-navy-950 px-3 py-1.5 text-xs font-medium text-ivory-100 hover:bg-navy-900">
                      {isLast ? "Finish" : "Next"} {isLast ? null : <ArrowRight size={13} />}
                    </button>
                  </div>
                </div>
                <button type="button" onClick={finish} className="mt-3 text-xs text-navy-700/45 underline underline-offset-2 hover:text-navy-700/70">
                  Skip tour
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

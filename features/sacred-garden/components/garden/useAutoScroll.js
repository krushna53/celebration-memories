"use client";
import { useEffect } from "react";

const SPEED = 45; // px per second: an easy reading pace on a phone
const PAUSE = 3000; // ms at the top of each section
const LONG_PAUSE = 6000; // ms at the RSVP form
const START_DELAY = 2500; // ms after the envelope has gone, so the names finish appearing

/**
 * After the invitation opens, glides down the page at reading pace, resting a moment as each section reaches the top
 * (longer at the RSVP). The first touch, wheel, key or scroll of the guest's own stops it for good, and it never runs
 * for people who ask their device for reduced motion.
 * active: start (the envelope is gone); root: the page element whose <section id> blocks are the stops.
 */
export function useAutoScroll(active, root) {
  useEffect(() => {
    if (!active || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    let raf = 0, timer = 0, stopped = false, last = 0, y = window.scrollY, pauseUntil = 0;
    const passed = new Set();
    const stops = () => [...(root.current?.querySelectorAll("section[id]") ?? []), document.getElementById("rsvp")].filter(Boolean);

    const stop = () => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      EVENTS.forEach((type) => window.removeEventListener(type, stop, true));
      window.removeEventListener("scroll", onScroll);
      document.documentElement.style.removeProperty("scroll-behavior");
    };
    // a scroll we didn't make (the guest's own, or a link) hands the page back to them
    const onScroll = () => { if (Math.abs(window.scrollY - Math.round(y)) > 3) stop(); };

    const step = (now) => {
      if (stopped) return;
      raf = requestAnimationFrame(step);
      const dt = last ? Math.min(100, now - last) : 0;
      last = now;
      if (now < pauseUntil) return;
      // rest when the next section's top reaches the top of the screen
      for (const el of stops()) {
        if (passed.has(el) || el.getBoundingClientRect().top > 2) continue;
        passed.add(el);
        if (y > 10) { pauseUntil = now + (el.id === "rsvp" ? LONG_PAUSE : PAUSE); return; }
      }
      const end = document.documentElement.scrollHeight - window.innerHeight;
      if (y >= end - 1) { stop(); return; }
      y = Math.min(end, y + (SPEED * dt) / 1000);
      window.scrollTo(0, Math.round(y));
    };

    timer = window.setTimeout(() => {
      if (stopped) return;
      y = window.scrollY;
      // the site scrolls smoothly for links; that would smear these small steps
      document.documentElement.style.setProperty("scroll-behavior", "auto");
      window.addEventListener("scroll", onScroll, { passive: true });
      raf = requestAnimationFrame(step);
    }, START_DELAY);
    EVENTS.forEach((type) => window.addEventListener(type, stop, { capture: true, passive: true }));
    return stop;
  }, [active, root]);
}

const EVENTS = ["wheel", "touchstart", "pointerdown", "keydown"];

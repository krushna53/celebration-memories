"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { GameResult } from "@/features/games/solo-game-shell";
import type { BubblePopConfig } from "@/types/games";

const COLORS = ["#f87171", "#fb923c", "#facc15", "#4ade80", "#38bdf8", "#a78bfa", "#f472b6"];
/** New balloon every … ms; slightly faster as the round goes on. */
const SPAWN_MS = 750;
/** Share of balloons showing the magic number — enough to keep little hands busy. */
const TARGET_SHARE = 0.45;

interface Balloon {
  id: number;
  num: number;
  /** Left position, % of the play area. */
  x: number;
  color: string;
  /** Seconds to float from bottom to top. */
  rise: number;
}

interface Pop {
  id: number;
  x: number;
  y: number;
  good: boolean;
}

function randomOther(target: number) {
  let n = target;
  while (n === target) n = 1 + Math.floor(Math.random() * 9);
  return n;
}

/**
 * Bubble Pop: numbered balloons float up; tap the ones showing the magic
 * number (6 for a 6th birthday) before they float away. Wrong taps just
 * wobble — no points lost, it's for little ones. Plain DOM + one CSS
 * keyframe, so it runs smoothly on older phones.
 */
export function BubblePopGame({ config, finish }: { config: BubblePopConfig; finish: (r: GameResult) => void }) {
  const [balloons, setBalloons] = useState<Balloon[]>([]);
  const [pops, setPops] = useState<Pop[]>([]);
  const [wobble, setWobble] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(config.seconds);
  const [countdown, setCountdown] = useState(3);
  const nextId = useRef(1);
  const scoreRef = useRef(0);
  const popped = useRef(new Set<number>());
  const startedAt = useRef(0);
  const areaRef = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  // The shell hands a fresh `finish` each render — keep the latest without restarting the timers.
  const finishRef = useRef(finish);
  finishRef.current = finish;

  // 3-2-1 before balloons start.
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 800);
    return () => clearTimeout(t);
  }, [countdown]);

  const end = useCallback(() => {
    if (done.current) return;
    done.current = true;
    const s = scoreRef.current;
    finishRef.current({
      score: s,
      durationSeconds: Math.round((Date.now() - startedAt.current) / 1000),
      headline: `${s} balloon${s === 1 ? "" : "s"}!`,
      detail: `You popped ${s} number ${config.target}${s === 1 ? "" : "s"}.`,
    });
  }, [config.target]);

  // Spawning + clock.
  useEffect(() => {
    if (countdown > 0) return;
    startedAt.current = Date.now();
    const spawn = setInterval(() => {
      const elapsed = (Date.now() - startedAt.current) / 1000;
      const isTarget = Math.random() < TARGET_SHARE;
      setBalloons((prev) => [
        ...prev,
        {
          id: nextId.current++,
          num: isTarget ? config.target : randomOther(config.target),
          x: 4 + Math.random() * 74,
          color: COLORS[Math.floor(Math.random() * COLORS.length)] ?? "#f87171",
          // Speeds up a little over the round.
          rise: Math.max(3.6, 6.2 - elapsed / 20) + Math.random() * 1.2,
        },
      ]);
    }, SPAWN_MS);
    const clock = setInterval(() => {
      const remaining = config.seconds - Math.floor((Date.now() - startedAt.current) / 1000);
      setLeft(Math.max(0, remaining));
      if (remaining <= 0) end();
    }, 250);
    return () => {
      clearInterval(spawn);
      clearInterval(clock);
    };
  }, [countdown, config.seconds, config.target, end]);

  function tap(b: Balloon, e: React.PointerEvent<HTMLButtonElement>) {
    if (done.current || popped.current.has(b.id)) return;
    if (b.num !== config.target) {
      setWobble(b.id);
      setTimeout(() => setWobble((w) => (w === b.id ? null : w)), 400);
      return;
    }
    popped.current.add(b.id);
    scoreRef.current += 1;
    setScore(scoreRef.current);
    const area = areaRef.current?.getBoundingClientRect();
    const pop = { id: b.id, x: e.clientX - (area?.left ?? 0), y: e.clientY - (area?.top ?? 0), good: true };
    setPops((prev) => [...prev, pop]);
    setTimeout(() => setPops((prev) => prev.filter((p) => p.id !== pop.id)), 700);
    setBalloons((prev) => prev.filter((x) => x.id !== b.id));
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(30);
  }

  return (
    <div className="select-none">
      <style>{`
        @keyframes bubble-rise { from { transform: translateY(0); } to { transform: translateY(calc(-100% - 70vh)); } }
        @keyframes bubble-sway { 0%,100% { margin-left: 0; } 50% { margin-left: 14px; } }
        @keyframes bubble-wobble { 0%,100% { rotate: 0deg; } 25% { rotate: -14deg; } 75% { rotate: 14deg; } }
        @keyframes bubble-burst { from { opacity: 1; transform: translate(-50%, -50%) scale(.6); } to { opacity: 0; transform: translate(-50%, -120%) scale(1.4); } }
      `}</style>

      <div className="mb-3 flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm">
        <p className="text-lg font-semibold text-navy-950">
          Pop the <span className="mx-1 inline-flex h-10 w-10 items-center justify-center rounded-full bg-gold-500 text-2xl">{config.target}</span>s!
        </p>
        <div className="text-right">
          <p className="text-2xl font-bold text-navy-950" aria-live="polite">⭐ {score}</p>
          <p className="text-xs text-navy-700/60">{left}s left</p>
        </div>
      </div>

      <div
        ref={areaRef}
        className="relative h-[70vh] overflow-hidden rounded-3xl bg-gradient-to-b from-sky-200 via-sky-100 to-ivory-50 touch-manipulation"
        aria-label={`Balloons — tap the ones with ${config.target}`}
      >
        {countdown > 0 ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <span className="font-display text-8xl text-navy-950/80">{countdown}</span>
          </div>
        ) : null}

        {balloons.map((b) => (
          <button
            key={b.id}
            type="button"
            onPointerDown={(e) => tap(b, e)}
            onAnimationEnd={(e) => {
              if (e.animationName !== "bubble-rise") return;
              setBalloons((prev) => prev.filter((x) => x.id !== b.id));
            }}
            aria-label={`Balloon ${b.num}`}
            className="absolute top-full flex flex-col items-center"
            style={{
              left: `${b.x}%`,
              animation: `bubble-rise ${b.rise}s linear forwards, bubble-sway 2.4s ease-in-out infinite`,
            }}
          >
            <span
              className="flex h-[76px] w-[66px] items-center justify-center rounded-[50%] text-3xl font-bold text-white shadow-md"
              style={{
                background: `radial-gradient(circle at 30% 28%, rgba(255,255,255,.55), ${b.color} 45%)`,
                animation: wobble === b.id ? "bubble-wobble .4s ease-in-out" : undefined,
                textShadow: "0 1px 2px rgba(0,0,0,.35)",
              }}
            >
              {b.num}
            </span>
            <span className="h-8 w-px bg-navy-950/30" />
          </button>
        ))}

        {pops.map((p) => (
          <span
            key={`pop-${p.id}`}
            className="pointer-events-none absolute text-3xl font-bold text-emerald-600"
            style={{ left: p.x, top: p.y, animation: "bubble-burst .7s ease-out forwards" }}
          >
            +1 🎉
          </span>
        ))}
      </div>
    </div>
  );
}

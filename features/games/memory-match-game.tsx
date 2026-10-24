"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { GameResult } from "@/features/games/solo-game-shell";

interface Card {
  id: number;
  /** Which photo — two cards share each. */
  pair: number;
  url: string;
}

function shuffle<T>(list: T[]): T[] {
  return list
    .map((v) => ({ v, k: Math.random() }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.v);
}

/**
 * Photo Memory Match: flip two cards at a time to find pairs of the
 * event's own photos. Moves and time are recorded; the leaderboard ranks
 * the fastest. Photos are preloaded so a flip never shows a blank card.
 */
export function MemoryMatchGame({ photoUrls, finish }: { photoUrls: string[]; finish: (r: GameResult) => void }) {
  const cards = useMemo<Card[]>(
    () => shuffle(photoUrls.flatMap((url, pair) => [{ id: pair * 2, pair, url }, { id: pair * 2 + 1, pair, url }])),
    [photoUrls],
  );
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [moves, setMoves] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(Date.now());
  const finishRef = useRef(finish);
  finishRef.current = finish;
  const done = useRef(false);

  useEffect(() => {
    for (const url of photoUrls) {
      const img = new Image();
      img.src = url;
    }
  }, [photoUrls]);

  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 500);
    return () => clearInterval(t);
  }, []);

  function flip(card: Card) {
    if (done.current || open.length === 2 || open.includes(card.id) || matched.has(card.pair)) return;
    const next = [...open, card.id];
    setOpen(next);
    if (next.length < 2) return;

    setMoves((m) => m + 1);
    const [a, b] = next.map((id) => cards.find((c) => c.id === id));
    if (a && b && a.pair === b.pair) {
      navigator.vibrate?.(30);
      const nextMatched = new Set(matched).add(a.pair);
      setMatched(nextMatched);
      setOpen([]);
      if (nextMatched.size === photoUrls.length) {
        done.current = true;
        const seconds = Math.round((Date.now() - startedAt.current) / 1000);
        const totalMoves = moves + 1;
        setTimeout(
          () =>
            finishRef.current({
              score: totalMoves,
              durationSeconds: seconds,
              headline: `All ${photoUrls.length} pairs! 🧠`,
              detail: `${totalMoves} moves in ${seconds} seconds.`,
            }),
          700,
        );
      }
    } else {
      setTimeout(() => setOpen([]), 900);
    }
  }

  const cols = photoUrls.length <= 6 ? "grid-cols-3" : "grid-cols-4";

  return (
    <div className="select-none">
      <style>{`
        .mm-card { perspective: 800px; }
        .mm-inner { transition: transform .45s ease; transform-style: preserve-3d; }
        .mm-flipped .mm-inner { transform: rotateY(180deg); }
        .mm-face { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
        .mm-back { transform: rotateY(180deg); }
      `}</style>
      <div className="mb-3 flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm">
        <p className="text-sm text-navy-700/70">
          Pairs found: <strong className="text-navy-950">{matched.size}</strong> / {photoUrls.length}
        </p>
        <p className="text-sm text-navy-700/70" aria-live="polite">
          {moves} moves · {elapsed}s
        </p>
      </div>
      <div className={`grid ${cols} gap-2.5`}>
        {cards.map((card) => {
          const isUp = open.includes(card.id) || matched.has(card.pair);
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => flip(card)}
              aria-label={isUp ? "Photo card, face up" : "Hidden card — tap to flip"}
              className={`mm-card aspect-square ${isUp ? "mm-flipped" : ""}`}
            >
              <span className="mm-inner relative block h-full w-full">
                <span className="mm-face absolute inset-0 flex items-center justify-center rounded-2xl bg-gradient-to-br from-gold-400 to-gold-600 text-4xl text-white shadow-md">
                  ★
                </span>
                <span
                  className={`mm-face mm-back absolute inset-0 overflow-hidden rounded-2xl bg-white shadow-md ${
                    matched.has(card.pair) ? "ring-4 ring-emerald-400" : ""
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={card.url} alt="" className="h-full w-full object-cover" draggable={false} />
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Trophy, CheckCircle2 } from "lucide-react";

import { readLine, lineCells } from "@/lib/word-search";
import { startGameAttemptAction, completeGameAttemptAction } from "@/features/games/actions";
import type { WordSearchConfig } from "@/types/games";

type Cell = { row: number; col: number };

function cellKey(c: Cell): string {
  return `${c.row}-${c.col}`;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

/**
 * Full guest-facing flow for one word search game, reached via
 * /games/[token]: identify (name + phone, matched against the RSVP
 * list the same way the public RSVP page does) -> play -> submit
 * completion time. All client-side except the two server actions
 * (start/complete) — grid validation (readLine/lineCells) runs locally
 * so dragging feels instant; the server only ever sees the final
 * found-words list + duration, not every attempt/miss.
 */
export function WordSearchGame({ token, title, config }: { token: string; title: string; config: WordSearchConfig }) {
  const [phase, setPhase] = useState<"identify" | "play" | "done">("identify");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [identifyError, setIdentifyError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);

  const [foundWords, setFoundWords] = useState<Set<string>>(new Set());
  const [foundCells, setFoundCells] = useState<Set<string>>(new Set());
  const [selecting, setSelecting] = useState(false);
  const [selStart, setSelStart] = useState<Cell | null>(null);
  const [selCurrent, setSelCurrent] = useState<Cell | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [finalDuration, setFinalDuration] = useState(0);
  const startTimeRef = useRef<number>(0);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (phase !== "play") return;
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000)), 500);
    return () => clearInterval(interval);
  }, [phase]);

  async function identify(e: React.FormEvent) {
    e.preventDefault();
    setIdentifyError(null);
    setStarting(true);
    const result = await startGameAttemptAction(token, { name, phone });
    setStarting(false);
    if (!result.success) {
      setIdentifyError(result.error);
      return;
    }
    setAttemptId(result.data.id);
    startTimeRef.current = Date.now();
    setPhase("play");
  }

  function activeSelectionCells(): Cell[] {
    if (!selStart || !selCurrent) return [];
    return lineCells(selStart, selCurrent);
  }

  function checkSelection(start: Cell, end: Cell) {
    const line = readLine(config.grid, start, end);
    if (!line) return;
    const reversed = line.split("").reverse().join("");
    const match = config.words.find((w) => w === line || w === reversed);
    if (match && !foundWords.has(match)) {
      setFoundWords((prev) => {
        const next = new Set(prev);
        next.add(match);
        return next;
      });
      setFoundCells((prev) => {
        const next = new Set(prev);
        for (const c of lineCells(start, end)) next.add(cellKey(c));
        return next;
      });
    }
  }

  function cellFromPoint(x: number, y: number): Cell | null {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    if (!el) return null;
    const row = el.getAttribute("data-row");
    const col = el.getAttribute("data-col");
    if (row === null || col === null) return null;
    return { row: Number(row), col: Number(col) };
  }

  function onCellDown(cell: Cell) {
    setSelecting(true);
    setSelStart(cell);
    setSelCurrent(cell);
  }

  function onCellEnter(cell: Cell) {
    if (!selecting) return;
    setSelCurrent(cell);
  }

  function finishSelection() {
    if (selecting && selStart && selCurrent) checkSelection(selStart, selCurrent);
    setSelecting(false);
    setSelStart(null);
    setSelCurrent(null);
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!selecting) return;
    const touch = e.touches[0];
    if (!touch) return;
    const cell = cellFromPoint(touch.clientX, touch.clientY);
    if (cell) setSelCurrent(cell);
  }

  useEffect(() => {
    if (foundWords.size > 0 && foundWords.size === config.words.length && phase === "play" && attemptId) {
      const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setFinalDuration(duration);
      setPhase("done");
      completeGameAttemptAction(attemptId, Array.from(foundWords), duration).catch((err) =>
        console.error("completeGameAttemptAction failed:", err),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foundWords]);

  const activeCells = new Set(activeSelectionCells().map(cellKey));

  if (phase === "identify") {
    return (
      <div className="mx-auto max-w-sm rounded-2xl border border-gold-500/20 bg-white p-6 text-center shadow-sm">
        <p className="font-display text-lg text-navy-950">{title}</p>
        <p className="mt-1 text-sm text-navy-700/60">Enter your name and phone to start — if you&rsquo;re on the guest list, we&rsquo;ll recognize you.</p>
        <form onSubmit={identify} className="mt-4 grid gap-2.5 text-left">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className={inputClasses} />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Your phone number"
            className={inputClasses}
          />
          {identifyError ? <p className="text-xs text-red-600">{identifyError}</p> : null}
          <button
            type="submit"
            disabled={starting || !name.trim() || !phone.trim()}
            className="mt-1 flex items-center justify-center gap-1.5 rounded-full bg-gold-500 px-4 py-2.5 text-sm font-medium text-navy-950 hover:brightness-110 disabled:opacity-60"
          >
            {starting ? <Loader2 size={14} className="animate-spin" /> : null} Start Puzzle
          </button>
        </form>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="mx-auto max-w-sm rounded-2xl border border-gold-500/20 bg-white p-6 text-center shadow-sm">
        <Trophy className="mx-auto text-gold-500" size={32} />
        <p className="mt-2 font-display text-xl text-navy-950">All words found!</p>
        <p className="mt-1 text-sm text-navy-700/70">
          Your time: <span className="font-medium text-navy-950">{formatDuration(finalDuration)}</span>
        </p>
        <p className="mt-3 text-xs text-navy-700/50">Thanks for playing, {name}!</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-sm text-navy-700/70">
        <p className="font-display text-navy-950">{title}</p>
        <p>{formatDuration(elapsed)}</p>
      </div>

      <div
        ref={gridRef}
        onMouseUp={finishSelection}
        onMouseLeave={finishSelection}
        onTouchEnd={finishSelection}
        onTouchMove={onTouchMove}
        className="grid touch-none select-none gap-0.5 rounded-xl border border-navy-950/10 bg-white p-2"
        style={{ gridTemplateColumns: `repeat(${config.size}, minmax(0, 1fr))` }}
      >
        {config.grid.map((row, r) =>
          row.map((letter, c) => {
            const key = cellKey({ row: r, col: c });
            const isFound = foundCells.has(key);
            const isActive = activeCells.has(key);
            return (
              <div
                key={key}
                data-row={r}
                data-col={c}
                onMouseDown={() => onCellDown({ row: r, col: c })}
                onMouseEnter={() => onCellEnter({ row: r, col: c })}
                onTouchStart={() => onCellDown({ row: r, col: c })}
                className={`flex aspect-square cursor-pointer items-center justify-center rounded text-xs font-medium sm:text-sm ${
                  isFound
                    ? "bg-gold-500/30 text-navy-950"
                    : isActive
                      ? "bg-gold-500/60 text-navy-950"
                      : "text-navy-700/80 hover:bg-navy-950/5"
                }`}
              >
                {letter}
              </div>
            );
          }),
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {config.words.map((word) => (
          <span
            key={word}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              foundWords.has(word)
                ? "border-gold-500/30 bg-gold-500/10 text-navy-700/40 line-through"
                : "border-navy-950/15 text-navy-700"
            }`}
          >
            {foundWords.has(word) ? <CheckCircle2 size={11} className="mr-1 inline" /> : null}
            {word}
          </span>
        ))}
      </div>
    </div>
  );
}

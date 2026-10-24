"use client";

import { useRef, useState, type ReactNode } from "react";
import { Loader2, RotateCcw, Trophy } from "lucide-react";

import { startGameAttemptAction, completeGameAttemptAction, getSoloLeaderboardAction } from "@/features/games/actions";
import { HowToPlay } from "@/features/games/how-to-play";
import { staleDeployMessage } from "@/lib/stale-deploy";
import type { GameType } from "@/types/games";

const inputClasses =
  "w-full rounded-xl border border-navy-950/15 bg-white px-4 py-3 text-base text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

export interface GameResult {
  /** Points (Bubble Pop, Animal Sounds) or moves (Memory Match). */
  score: number;
  durationSeconds: number;
  /** Shown big on the result screen, e.g. "12 balloons!" */
  headline: string;
  detail?: string;
}

interface SoloGameShellProps {
  token: string;
  type: GameType;
  title: string;
  /** Rendered while playing; call `finish` once with the result. `round` changes on every replay so the game remounts fresh. */
  children: (props: { finish: (result: GameResult) => void; round: number }) => ReactNode;
}

/**
 * Shared frame for the kids' solo games (Bubble Pop, Animal Sounds,
 * Memory Match): name + phone (a parent's is fine — matched against the
 * guest list like Word Search), play, result, play again. Each play is
 * its own game_attempts row, so the host's leaderboard shows every try.
 */
export function SoloGameShell({ token, type, title, children }: SoloGameShellProps) {
  const [phase, setPhase] = useState<"identify" | "play" | "done">("identify");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [result, setResult] = useState<GameResult | null>(null);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [leaders, setLeaders] = useState<{ name: string; score: number | null; seconds: number | null }[]>([]);
  const finished = useRef(false);

  async function start() {
    setError(null);
    setStarting(true);
    const res = await startGameAttemptAction(token, { name, phone }).catch((err: unknown) => ({
      success: false as const,
      error: staleDeployMessage(err) ?? "Couldn't start the game.",
    }));
    setStarting(false);
    if (!res.success) {
      setError(res.error);
      setPhase("identify");
      return;
    }
    finished.current = false;
    setSaved(false);
    setLeaders([]);
    setAttemptId(res.data.id);
    setResult(null);
    setRound((r) => r + 1);
    setPhase("play");
  }

  async function saveResult(r: GameResult) {
    if (!attemptId) return;
    setSaving(true);
    setError(null);
    try {
      const response = await completeGameAttemptAction(attemptId, [], r.durationSeconds, r.score);
      if (!response.success) { setError(response.error); return; }
      setSaved(true);
      const board = await getSoloLeaderboardAction(token);
      if (board.success) setLeaders(board.data);
      else setError(board.error);
    } catch (err) {
      setError(staleDeployMessage(err) ?? "Couldn't save your score. Please retry.");
    } finally {
      setSaving(false);
    }
  }

  function finish(r: GameResult) {
    if (finished.current) return;
    finished.current = true;
    setResult(r);
    setPhase("done");
    void saveResult(r);
  }

  return (
    <div>
      <h1 className="text-center font-display text-3xl text-navy-950">{title}</h1>

      {phase === "identify" ? (
        <form
          className="mt-6 grid gap-3 rounded-2xl border border-gold-500/20 bg-white p-5 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault();
            void start();
          }}
        >
          <HowToPlay type={type} />
          <input
            className={inputClasses}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Player's name"
            aria-label="Player's name"
            autoComplete="off"
            maxLength={120}
            required
          />
          <input
            className={inputClasses}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number (a grown-up's is fine)"
            aria-label="Phone number"
            inputMode="tel"
            autoComplete="tel"
            maxLength={20}
            required
          />
          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={starting || saving}
            className="flex items-center justify-center gap-2 rounded-full bg-gold-500 px-6 py-4 text-lg font-semibold text-navy-950 hover:brightness-110 disabled:opacity-60"
          >
            {starting ? <Loader2 className="animate-spin" size={20} /> : null} Let&rsquo;s play!
          </button>
        </form>
      ) : null}

      {phase === "play" ? <div className="mt-4">{children({ finish, round })}</div> : null}

      {phase === "done" && result ? (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-gold-500/20 bg-white px-6 py-10 text-center shadow-sm" role="status">
          <Trophy className="text-gold-500" size={44} />
          <p className="font-display text-3xl text-navy-950">{result.headline}</p>
          {result.detail ? <p className="text-navy-700/70">{result.detail}</p> : null}
          <p className="text-sm text-navy-700/50">Well played, {name.trim().split(" ")[0] || "superstar"}! 🎉</p>
          <p className="text-sm text-navy-700/60">{saving ? "Saving score…" : saved ? "Score saved!" : "Score not saved yet."}</p>
          {!saving && !saved ? <button type="button" onClick={() => void saveResult(result)} className="underline">Retry saving score</button> : null}
          {leaders.length > 0 ? (
            <div className="w-full text-left">
              <h2 className="font-semibold text-navy-950">Scoreboard</h2>
              <ol className="mt-2 grid gap-2">
                {leaders.map((entry, i) => <li key={i} className="flex justify-between gap-3 text-sm">
                  <span>{i + 1}. {entry.name}</span>
                  <span>{type === "memory_match" ? `${entry.seconds}s · ${entry.score} moves` : `${entry.score} points · ${entry.seconds}s`}</span>
                </li>)}
              </ol>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => void start()}
            disabled={starting || saving}
            className="mt-2 flex items-center gap-2 rounded-full bg-gold-500 px-6 py-3 text-base font-semibold text-navy-950 hover:brightness-110 disabled:opacity-60"
          >
            {starting ? <Loader2 className="animate-spin" size={18} /> : <RotateCcw size={18} />} Play again
          </button>
          <button
            type="button"
            disabled={saving || starting}
            onClick={() => {
              setError(null);
              setName("");
              setPhone("");
              setPhase("identify");
            }}
            className="text-sm text-navy-700/60 underline"
          >
            Next player
          </button>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

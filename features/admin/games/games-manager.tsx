"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Copy, MessageCircle, Loader2, Plus, Trash2, Trophy, Power, Play, Square, Radio } from "lucide-react";

import { qrImageUrl } from "@/lib/qr";
import { HOUSIE_PATTERNS, MOVIE_PATTERNS } from "@/lib/housie";
import {
  createWordSearchGameAction,
  createHousieGameAction,
  createMovieHousieGameAction,
  setGameActiveAction,
  setGameStatusAction,
  callNextItemAction,
  deleteGameAction,
} from "@/features/admin/games/actions";
import { AdminHowToPlay } from "@/features/admin/games/admin-how-to-play";
import type { GameRecord, GameAttemptRecord, GameClaimRecord, GameType } from "@/types/games";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

const GAME_TYPE_LABEL: Record<GameType, string> = {
  word_search: "Word Search",
  housie: "Housie (Tambola)",
  movie_housie: "Movie Name Housie",
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function GamesManager({
  eventId,
  honoreeName,
  initialGames,
  attemptsByGame,
  claimsByGame,
  ticketCountByGame,
}: {
  eventId: string;
  honoreeName: string;
  initialGames: GameRecord[];
  attemptsByGame: Record<string, GameAttemptRecord[]>;
  claimsByGame: Record<string, GameClaimRecord[]>;
  ticketCountByGame: Record<string, number>;
}) {
  const [games, setGames] = useState(initialGames);
  const [tab, setTab] = useState<GameType>("word_search");

  const [title, setTitle] = useState("");
  const [wordsText, setWordsText] = useState("");
  const [poolText, setPoolText] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  function resetForm() {
    setTitle("");
    setWordsText("");
    setPoolText("");
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    const result =
      tab === "word_search"
        ? await createWordSearchGameAction(eventId, { title, wordsText })
        : tab === "housie"
          ? await createHousieGameAction(eventId, { title })
          : await createMovieHousieGameAction(eventId, { title, poolText });
    setCreating(false);
    if (result.success) {
      setGames((prev) => [result.data, ...prev]);
      resetForm();
    } else {
      setCreateError(result.error);
    }
  }

  return (
    <div>
      <div className="flex gap-2 border-b border-navy-950/10">
        {(Object.keys(GAME_TYPE_LABEL) as GameType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              setCreateError(null);
            }}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition-luxury duration-200 ${
              tab === t ? "border-gold-500 text-navy-950" : "border-transparent text-navy-700/50 hover:text-navy-700"
            }`}
          >
            {GAME_TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <AdminHowToPlay type={tab} />
      </div>

      <form onSubmit={create} className="grid gap-2.5 rounded-xl border border-navy-950/10 bg-white p-4">
        <h2 className="font-display text-lg text-navy-950">New {GAME_TYPE_LABEL[tab]}</h2>
        <p className="text-xs text-navy-700/50">
          {tab === "word_search"
            ? "Guests drag to find hidden words, racing against the clock — full rules are shown to them automatically."
            : tab === "housie"
              ? "Classic Tambola: guests get a numbered ticket, you call numbers live, they claim prizes as they complete them — full rules are shown to them automatically."
              : "Guests get a 5x5 card of movie names instead of numbers — same calling/claiming flow as Housie. Full rules are shown to them automatically."}
        </p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={
            tab === "word_search"
              ? `Puzzle title — e.g. "Find ${honoreeName.split(" ")[0]}'s Favorites"`
              : `Game title — e.g. "${honoreeName.split(" ")[0]}'s Birthday ${GAME_TYPE_LABEL[tab]}"`
          }
          className={inputClasses}
        />
        {tab === "word_search" ? (
          <textarea
            value={wordsText}
            onChange={(e) => setWordsText(e.target.value)}
            placeholder={"Words — one per line or comma-separated, e.g.\nMAHESH\nMUMBAI\nGOLF\nFAMILY\nCRICKET"}
            rows={5}
            className={`${inputClasses} resize-none`}
          />
        ) : null}
        {tab === "housie" ? (
          <p className="text-xs text-navy-700/50">
            Uses the standard 1-90 numbered ticket — no extra setup needed. You&rsquo;ll call numbers live from this
            page once guests have joined.
          </p>
        ) : null}
        {tab === "movie_housie" ? (
          <textarea
            value={poolText}
            onChange={(e) => setPoolText(e.target.value)}
            placeholder={"At least 25 movie names — one per line or comma-separated, e.g.\nSHOLAY\nDDLJ\n3 IDIOTS\n..."}
            rows={5}
            className={`${inputClasses} resize-none`}
          />
        ) : null}
        {createError ? <p className="text-xs text-red-600">{createError}</p> : null}
        <button
          type="submit"
          disabled={creating || !title.trim() || (tab === "word_search" && !wordsText.trim()) || (tab === "movie_housie" && !poolText.trim())}
          className="flex items-center justify-center gap-1.5 rounded-full bg-gold-500 px-4 py-2 text-sm font-medium text-navy-950 hover:brightness-110 disabled:opacity-60 sm:justify-self-start"
        >
          {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Create Game
        </button>
      </form>

      <div className="mt-6 grid gap-4">
        {games.length === 0 ? (
          <p className="text-sm text-navy-700/50">No games yet — create your first one above.</p>
        ) : (
          games.map((game) => (
            <GameCard
              key={game.id}
              eventId={eventId}
              game={game}
              attempts={attemptsByGame[game.id] ?? []}
              claims={claimsByGame[game.id] ?? []}
              ticketCount={ticketCountByGame[game.id] ?? 0}
              onDeleted={() => setGames((prev) => prev.filter((g) => g.id !== game.id))}
              onChanged={(patch) => setGames((prev) => prev.map((g) => (g.id === game.id ? { ...g, ...patch } : g)))}
            />
          ))
        )}
      </div>
    </div>
  );
}

function GameCard({
  eventId,
  game,
  attempts,
  claims,
  ticketCount,
  onDeleted,
  onChanged,
}: {
  eventId: string;
  game: GameRecord;
  attempts: GameAttemptRecord[];
  claims: GameClaimRecord[];
  ticketCount: number;
  onDeleted: () => void;
  onChanged: (patch: Partial<GameRecord>) => void;
}) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lastCalled, setLastCalled] = useState<number | string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const link = origin ? `${origin}/games/${game.shareToken}` : "";
  const completed = attempts.filter((a) => a.completedAt);
  const isCallingGame = game.type === "housie" || game.type === "movie_housie";
  const patterns = game.type === "housie" ? HOUSIE_PATTERNS : MOVIE_PATTERNS;

  function copy() {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function shareViaWhatsApp() {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`Play our game — ${game.title}: ${link}`)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  function toggleActive() {
    startTransition(async () => {
      const result = await setGameActiveAction(eventId, game.id, !game.isActive);
      if (result.success) onChanged({ isActive: !game.isActive });
      else setError(result.error);
    });
  }

  function remove() {
    if (!confirm(`Delete "${game.title}"? This also removes everyone's scores/tickets for it.`)) return;
    startTransition(async () => {
      const result = await deleteGameAction(eventId, game.id);
      if (result.success) onDeleted();
      else setError(result.error);
    });
  }

  function startCalling() {
    startTransition(async () => {
      const result = await setGameStatusAction(eventId, game.id, "live");
      if (result.success) onChanged({ status: "live" });
      else setError(result.error);
    });
  }

  function endCalling() {
    if (!confirm("End this game? Guests won't be able to claim any more prizes.")) return;
    startTransition(async () => {
      const result = await setGameStatusAction(eventId, game.id, "ended");
      if (result.success) onChanged({ status: "ended" });
      else setError(result.error);
    });
  }

  function callNext() {
    startTransition(async () => {
      const result = await callNextItemAction(eventId, game.id);
      if (result.success) {
        if (result.data === null) {
          setError("All numbers/movies have been called.");
        } else {
          setLastCalled(result.data);
          onChanged({ calledItems: [...game.calledItems, result.data], status: "live" });
        }
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="rounded-xl border border-navy-950/10 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-navy-950">{game.title}</p>
          <p className="text-xs text-navy-700/50">
            {GAME_TYPE_LABEL[game.type]} &middot;{" "}
            {isCallingGame ? `${ticketCount} joined` : `${game.config && "words" in game.config ? game.config.words.length : 0} words`} &middot;{" "}
            {isCallingGame ? "" : `${completed.length} completed`}
            {isCallingGame ? (
              <span className={game.status === "live" ? "text-emerald-600" : game.status === "ended" ? "text-navy-700/40" : "text-gold-600"}>
                {game.status === "live" ? "Live" : game.status === "ended" ? "Ended" : "Waiting to start"}
              </span>
            ) : null}
            {" "}&middot; {game.isActive ? <span className="text-emerald-600">Link Active</span> : <span className="text-navy-700/40">Link Paused</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleActive}
            disabled={pending}
            className="flex items-center gap-1.5 rounded-full border border-navy-950/15 px-3 py-1.5 text-xs font-medium text-navy-700 hover:border-navy-950/30 hover:text-navy-950"
          >
            <Power size={12} /> {game.isActive ? "Pause Link" : "Resume Link"}
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="flex items-center gap-1.5 rounded-full border border-navy-950/15 px-3 py-1.5 text-xs font-medium text-navy-700 hover:border-red-300 hover:text-red-600"
          >
            <Trash2 size={12} /> Delete
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr]">
        {link ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={qrImageUrl(link)} alt="QR code to play" className="h-32 w-32 rounded-lg border border-navy-950/10" />
        ) : null}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg border border-navy-950/10 bg-navy-950/[0.02] px-3 py-2 text-xs text-navy-700">
              {link || "Loading..."}
            </code>
            <button
              type="button"
              onClick={copy}
              disabled={!link}
              className="flex items-center gap-1.5 rounded-full border border-navy-950/15 bg-white px-3 py-1.5 text-xs font-medium text-navy-700 hover:border-navy-950/30 hover:text-navy-950"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              onClick={shareViaWhatsApp}
              disabled={!link}
              className="flex items-center gap-1.5 rounded-full border border-navy-950/15 bg-white px-3 py-1.5 text-xs font-medium text-navy-700 hover:border-navy-950/30 hover:text-navy-950"
            >
              <MessageCircle size={13} /> WhatsApp
            </button>
          </div>

          {!isCallingGame && completed.length > 0 ? (
            <div className="mt-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-navy-700/70">
                <Trophy size={12} className="text-gold-500" /> Leaderboard
              </p>
              <ol className="mt-1.5 grid gap-1 text-sm text-navy-700/80">
                {completed.slice(0, 10).map((a, i) => (
                  <li key={a.id} className="flex justify-between">
                    <span>
                      {i + 1}. {a.playerName}
                    </span>
                    <span className="text-navy-700/50">{formatDuration(a.durationSeconds ?? 0)}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {isCallingGame ? (
            <div className="mt-3">
              <div className="flex flex-wrap items-center gap-2">
                {game.status === "waiting" ? (
                  <button
                    type="button"
                    onClick={startCalling}
                    disabled={pending}
                    className="flex items-center gap-1.5 rounded-full bg-gold-500 px-3 py-1.5 text-xs font-medium text-navy-950 hover:brightness-110"
                  >
                    <Play size={12} /> Start
                  </button>
                ) : null}
                {game.status !== "ended" ? (
                  <>
                    <button
                      type="button"
                      onClick={callNext}
                      disabled={pending}
                      className="flex items-center gap-1.5 rounded-full bg-navy-950 px-3 py-1.5 text-xs font-medium text-ivory-50 hover:brightness-110"
                    >
                      <Radio size={12} /> Call Next
                    </button>
                    <button
                      type="button"
                      onClick={endCalling}
                      disabled={pending}
                      className="flex items-center gap-1.5 rounded-full border border-navy-950/15 px-3 py-1.5 text-xs font-medium text-navy-700 hover:border-red-300 hover:text-red-600"
                    >
                      <Square size={12} /> End Game
                    </button>
                  </>
                ) : null}
                {lastCalled !== null ? (
                  <span className="rounded-full bg-gold-500/15 px-3 py-1.5 text-xs font-medium text-navy-950">
                    Called: {lastCalled}
                  </span>
                ) : null}
              </div>

              {game.calledItems.length > 0 ? (
                <p className="mt-2 text-xs text-navy-700/50">
                  {game.calledItems.length} called so far: {game.calledItems.slice(-20).join(", ")}
                </p>
              ) : null}

              <div className="mt-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-navy-700/70">
                  <Trophy size={12} className="text-gold-500" /> Winners
                </p>
                {claims.length === 0 ? (
                  <p className="mt-1 text-xs text-navy-700/40">No prizes claimed yet.</p>
                ) : (
                  <ol className="mt-1.5 grid gap-1 text-sm text-navy-700/80">
                    {claims.map((c) => {
                      const label = patterns.find((p) => p.id === c.pattern)?.label ?? c.pattern;
                      return (
                        <li key={c.id} className="flex justify-between">
                          <span>{label}</span>
                          <span className="text-navy-700/50">{c.playerName}</span>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

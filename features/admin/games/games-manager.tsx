"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Copy, MessageCircle, Loader2, Plus, Trash2, Trophy, Power } from "lucide-react";

import { qrImageUrl } from "@/lib/qr";
import {
  createWordSearchGameAction,
  setGameActiveAction,
  deleteGameAction,
} from "@/features/admin/games/actions";
import type { GameRecord, GameAttemptRecord } from "@/types/games";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

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
}: {
  eventId: string;
  honoreeName: string;
  initialGames: GameRecord[];
  attemptsByGame: Record<string, GameAttemptRecord[]>;
}) {
  const [games, setGames] = useState(initialGames);
  const [title, setTitle] = useState("");
  const [wordsText, setWordsText] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    const result = await createWordSearchGameAction(eventId, { title, wordsText });
    setCreating(false);
    if (result.success) {
      setGames((prev) => [result.data, ...prev]);
      setTitle("");
      setWordsText("");
    } else {
      setCreateError(result.error);
    }
  }

  return (
    <div>
      <form onSubmit={create} className="grid gap-2.5 rounded-xl border border-navy-950/10 bg-white p-4">
        <h2 className="font-display text-lg text-navy-950">New Word Search</h2>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={`Puzzle title — e.g. "Find ${honoreeName.split(" ")[0]}'s Favorites"`}
          className={inputClasses}
        />
        <textarea
          value={wordsText}
          onChange={(e) => setWordsText(e.target.value)}
          placeholder={"Words — one per line or comma-separated, e.g.\nMAHESH\nMUMBAI\nGOLF\nFAMILY\nCRICKET"}
          rows={5}
          className={`${inputClasses} resize-none`}
        />
        {createError ? <p className="text-xs text-red-600">{createError}</p> : null}
        <button
          type="submit"
          disabled={creating || !title.trim() || !wordsText.trim()}
          className="flex items-center justify-center gap-1.5 rounded-full bg-gold-500 px-4 py-2 text-sm font-medium text-navy-950 hover:brightness-110 disabled:opacity-60 sm:justify-self-start"
        >
          {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Create Puzzle
        </button>
      </form>

      <div className="mt-6 grid gap-4">
        {games.length === 0 ? (
          <p className="text-sm text-navy-700/50">No games yet — create your first word search above.</p>
        ) : (
          games.map((game) => (
            <GameCard key={game.id} eventId={eventId} game={game} attempts={attemptsByGame[game.id] ?? []} onDeleted={() => setGames((prev) => prev.filter((g) => g.id !== game.id))} onToggled={(active) => setGames((prev) => prev.map((g) => (g.id === game.id ? { ...g, isActive: active } : g)))} />
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
  onDeleted,
  onToggled,
}: {
  eventId: string;
  game: GameRecord;
  attempts: GameAttemptRecord[];
  onDeleted: () => void;
  onToggled: (active: boolean) => void;
}) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const link = origin ? `${origin}/games/${game.shareToken}` : "";
  const completed = attempts.filter((a) => a.completedAt);

  function copy() {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function shareViaWhatsApp() {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`Play our word search game — ${game.title}: ${link}`)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  function toggleActive() {
    startTransition(async () => {
      const result = await setGameActiveAction(eventId, game.id, !game.isActive);
      if (result.success) onToggled(!game.isActive);
      else setError(result.error);
    });
  }

  function remove() {
    if (!confirm(`Delete "${game.title}"? This also removes everyone's scores for it.`)) return;
    startTransition(async () => {
      const result = await deleteGameAction(eventId, game.id);
      if (result.success) onDeleted();
      else setError(result.error);
    });
  }

  return (
    <div className="rounded-xl border border-navy-950/10 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-navy-950">{game.title}</p>
          <p className="text-xs text-navy-700/50">
            {game.config.words.length} words &middot; {completed.length} completed &middot;{" "}
            {game.isActive ? <span className="text-emerald-600">Active</span> : <span className="text-navy-700/40">Paused</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleActive}
            disabled={pending}
            className="flex items-center gap-1.5 rounded-full border border-navy-950/15 px-3 py-1.5 text-xs font-medium text-navy-700 hover:border-navy-950/30 hover:text-navy-950"
          >
            <Power size={12} /> {game.isActive ? "Pause" : "Resume"}
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

          {completed.length > 0 ? (
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
        </div>
      </div>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

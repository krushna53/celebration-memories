"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, PartyPopper } from "lucide-react";

import { HOUSIE_PATTERNS, MOVIE_PATTERNS } from "@/lib/housie";
import { joinTicketGameAction, getGameCallStateAction, claimPrizeAction } from "@/features/games/actions";
import { HowToPlay } from "@/features/games/how-to-play";
import type { GameType, GameStatus } from "@/types/games";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

/**
 * Guest-facing flow for /games/[token] when the game is housie or
 * movie_housie: identify -> join (get/resume a ticket) -> watch the
 * host's calls arrive via polling (getGameCallStateAction every 3s —
 * this project has no realtime subscriptions set up yet, and a party
 * game's calling cadence is slow enough that a few seconds of latency
 * is imperceptible) -> claim prizes as they're completed.
 */
export function HousieGame({ token, type, title }: { token: string; type: GameType; title: string }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<(number | null)[][] | string[][] | null>(null);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [calledItems, setCalledItems] = useState<(number | string)[]>([]);
  const [status, setStatus] = useState<GameStatus>("waiting");
  const [claimMessages, setClaimMessages] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [claiming, setClaiming] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const patterns = type === "housie" ? HOUSIE_PATTERNS : MOVIE_PATTERNS;

  useEffect(() => {
    if (!ticketId) return;
    async function poll() {
      const result = await getGameCallStateAction(token);
      if (result.success) {
        setCalledItems(result.data.calledItems);
        setStatus(result.data.status);
      }
    }
    poll();
    pollRef.current = setInterval(poll, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [ticketId, token]);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setJoinError(null);
    setJoining(true);
    const result = await joinTicketGameAction(token, { name, phone });
    setJoining(false);
    if (!result.success) {
      setJoinError(result.error);
      return;
    }
    setTicket(result.data.ticket.ticket);
    setTicketId(result.data.ticket.id);
  }

  async function claim(pattern: string) {
    if (!ticketId) return;
    setClaiming(pattern);
    const result = await claimPrizeAction(token, ticketId, pattern);
    setClaiming(null);
    setClaimMessages((prev) => ({
      ...prev,
      [pattern]: result.success ? { ok: true, text: "You won this prize!" } : { ok: false, text: result.error },
    }));
  }

  const called = new Set(calledItems);

  if (!ticket || !ticketId) {
    return (
      <div className="mx-auto max-w-sm">
        <HowToPlay type={type} />
        <div className="rounded-2xl border border-gold-500/20 bg-white p-6 text-center shadow-sm">
          <p className="font-display text-lg text-navy-950">{title}</p>
          <p className="mt-1 text-sm text-navy-700/60">
            Enter your name and phone to get your {type === "housie" ? "ticket" : "card"} — if you&rsquo;re on the guest
            list, we&rsquo;ll recognize you.
          </p>
          <form onSubmit={join} className="mt-4 grid gap-2.5 text-left">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className={inputClasses} />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Your phone number"
              className={inputClasses}
            />
            {joinError ? <p className="text-xs text-red-600">{joinError}</p> : null}
            <button
              type="submit"
              disabled={joining || !name.trim() || !phone.trim()}
              className="mt-1 flex items-center justify-center gap-1.5 rounded-full bg-gold-500 px-4 py-2.5 text-sm font-medium text-navy-950 hover:brightness-110 disabled:opacity-60"
            >
              {joining ? <Loader2 size={14} className="animate-spin" /> : null} Join Game
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-sm">
        <p className="font-display text-navy-950">{title}</p>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            status === "live" ? "bg-emerald-500/10 text-emerald-600" : status === "ended" ? "bg-navy-950/5 text-navy-700/50" : "bg-gold-500/10 text-gold-600"
          }`}
        >
          {status === "live" ? "Live" : status === "ended" ? "Ended" : "Waiting for host to start..."}
        </span>
      </div>

      {calledItems.length > 0 ? (
        <div className="mb-4 rounded-xl border border-navy-950/10 bg-white p-3">
          <p className="text-xs font-medium text-navy-700/60">Last called</p>
          <p className="mt-1 font-display text-xl text-navy-950">{calledItems[calledItems.length - 1]}</p>
          <p className="mt-1 truncate text-xs text-navy-700/40">
            {calledItems
              .slice(-15, -1)
              .reverse()
              .join(", ")}
          </p>
        </div>
      ) : null}

      {type === "housie" ? (
        <div className="grid grid-cols-9 gap-0.5 rounded-xl border border-navy-950/10 bg-white p-2">
          {(ticket as (number | null)[][]).flatMap((row, r) =>
            row.map((num, c) => (
              <div
                key={`${r}-${c}`}
                className={`flex aspect-square items-center justify-center rounded text-xs font-medium sm:text-sm ${
                  num === null
                    ? ""
                    : called.has(num)
                      ? "bg-gold-500/60 text-navy-950"
                      : "border border-navy-950/10 text-navy-700"
                }`}
              >
                {num ?? ""}
              </div>
            )),
          )}
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-1 rounded-xl border border-navy-950/10 bg-white p-2">
          {(ticket as string[][]).flatMap((row, r) =>
            row.map((movie, c) => (
              <div
                key={`${r}-${c}`}
                className={`flex aspect-square items-center justify-center rounded p-1 text-center text-[10px] font-medium leading-tight sm:text-xs ${
                  called.has(movie) ? "bg-gold-500/60 text-navy-950" : "border border-navy-950/10 text-navy-700"
                }`}
              >
                {movie}
              </div>
            )),
          )}
        </div>
      )}

      <div className="mt-4 grid gap-2">
        {patterns.map((p) => {
          const msg = claimMessages[p.id];
          return (
            <div key={p.id}>
              <button
                type="button"
                onClick={() => claim(p.id)}
                disabled={claiming === p.id || msg?.ok}
                className="flex w-full items-center justify-center gap-1.5 rounded-full border border-gold-500/40 bg-gold-500/10 px-4 py-2 text-sm font-medium text-navy-950 hover:bg-gold-500/20 disabled:opacity-60"
              >
                {claiming === p.id ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : msg?.ok ? (
                  <PartyPopper size={13} className="text-gold-600" />
                ) : null}
                Claim: {p.label}
              </button>
              {msg ? (
                <p className={`mt-1 text-center text-xs ${msg.ok ? "text-emerald-600" : "text-navy-700/50"}`}>{msg.text}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

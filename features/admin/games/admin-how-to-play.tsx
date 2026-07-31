"use client";

import { useState } from "react";
import { HelpCircle, ChevronDown, UserCog, Users } from "lucide-react";

import type { GameType } from "@/types/games";

const HOST_STEPS: Record<GameType, string[]> = {
  word_search: [
    "Enter a title and a list of words (one per line or comma-separated) — pick words tied to the honoree: their name, nicknames, hobbies, hometown, favorite things.",
    "Click \"Create Game\" — a puzzle grid is generated automatically from your words. Some very long or unusual words may not fit and get skipped; you'll be told if that happens.",
    "Share the link or QR code that appears — print the QR code for a table card, show it on a screen, or send the link over WhatsApp.",
    "Guests play independently on their own phones — there's nothing more for you to do once it's shared.",
    "Watch the leaderboard on this page fill in live as guests finish, fastest time first.",
    "Use \"Pause Link\" to stop new players from joining (existing players already in can still finish), or \"Delete\" to remove the game and everyone's scores entirely.",
  ],
  housie: [
    "Enter a title and click \"Create Game\" — no word list needed, it always uses the standard 1-90 numbered ticket.",
    "Share the link or QR code with guests ahead of time so they can join and get their ticket before play begins.",
    "When you're ready to begin, click \"Start\" on this page.",
    "Call numbers out loud the normal way, and click \"Call Next\" here each time — it picks a random number that hasn't been called yet and every joined guest's ticket updates within a few seconds.",
    "Guests tap \"Claim\" on their own device the moment they complete a prize. Watch the \"Winners\" list here — the first valid claim for each prize wins it automatically; anyone claiming after that (or claiming before they've actually completed it) is rejected without you needing to referee.",
    "Prizes run easiest to hardest: Early Five, Top Line, Middle Line, Bottom Line, Full House.",
    "Click \"End Game\" once you're done — no further claims are accepted after that, and you can start a fresh game anytime.",
  ],
  movie_housie: [
    "Enter a title and at least 25 movie names (one per line or comma-separated) — pick titles most of your guests will recognize.",
    "Click \"Create Game\" — each guest gets their own randomly shuffled 5x5 card drawn from your movie list, so no two guests have an identical card.",
    "Share the link or QR code ahead of time so guests can join and get their card before play begins.",
    "Click \"Start\" when ready, then click \"Call Next\" each time you announce a movie name out loud — it picks one from your list that hasn't been called yet.",
    "Guests tap \"Claim\" the moment they complete a row, column, or diagonal (Line) or their whole card (Full House). The \"Winners\" list here fills in automatically as valid claims come in — only the first valid claim for each prize counts.",
    "Click \"End Game\" when you're finished.",
  ],
};

const GUEST_STEPS: Record<GameType, string[]> = {
  word_search: [
    "Scan the QR code, or open the link the host shared.",
    "Enter your name and phone number — if you're already on the host's guest list, you'll be recognized automatically instead of starting fresh.",
    "Every word on the list is hidden in the grid — across, down, or diagonally, and can read forwards or backwards.",
    "Tap or click the first letter of a word, then drag to its last letter to select it.",
    "A correct selection highlights gold and crosses that word off your list.",
    "Find every word as fast as you can — the moment you finish, your time is recorded and sent to the host's leaderboard.",
  ],
  housie: [
    "Scan the QR code, or open the link the host shared.",
    "Enter your name and phone number — if you're already on the host's guest list, you'll be recognized automatically.",
    "You'll get a ticket with 15 numbers spread across 3 rows.",
    "As the host calls numbers out loud, any matching number on your ticket highlights automatically within a few seconds — no need to mark it yourself.",
    "The moment you complete a prize, tap \"Claim\" for it right on your screen. The first guest to validly claim each prize wins it.",
    "Prizes, easiest to hardest: Early Five (any 5 numbers marked), Top/Middle/Bottom Line (a full row), Full House (all 15 numbers).",
    "No harm in tapping Claim early — if it's not actually complete yet, you'll just be told so and can keep playing.",
  ],
  movie_housie: [
    "Scan the QR code, or open the link the host shared.",
    "Enter your name and phone number — if you're already on the host's guest list, you'll be recognized automatically.",
    "You'll get a 5x5 card of movie names instead of numbers.",
    "As the host calls out movie names, any matching name on your card highlights automatically.",
    "Complete any full row, column, or diagonal for a Line win, or fill your entire card for Full House.",
    "Tap \"Claim\" the moment you complete one — first valid claim for each prize wins it.",
  ],
};

const GAME_TYPE_LABEL: Record<GameType, string> = {
  word_search: "Word Search",
  housie: "Housie (Tambola)",
  movie_housie: "Movie Name Housie",
};

/**
 * Detailed, dual-audience rules panel shown on /admin/games itself —
 * separate from features/games/how-to-play.tsx, which is the shorter
 * guest-only version shown on the public /games/[token] page. This one
 * exists so the host (owner or client) can see exactly what running
 * the game involves, plus a copy of the guest-facing rules, all in one
 * place before they create or share anything.
 */
export function AdminHowToPlay({ type }: { type: GameType }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"host" | "guest">("host");
  const steps = (tab === "host" ? HOST_STEPS : GUEST_STEPS)[type];

  return (
    <div className="mb-4 rounded-xl border border-gold-500/20 bg-gold-500/5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium text-navy-950"
      >
        <span className="flex items-center gap-1.5">
          <HelpCircle size={15} className="text-gold-600" /> How to Play — {GAME_TYPE_LABEL[type]}
        </span>
        <ChevronDown size={14} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>
      {open ? (
        <div className="border-t border-gold-500/15 px-4 py-3">
          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={() => setTab("host")}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                tab === "host" ? "bg-navy-950 text-ivory-50" : "border border-navy-950/15 text-navy-700 hover:bg-navy-950/5"
              }`}
            >
              <UserCog size={12} /> As the Host (You)
            </button>
            <button
              type="button"
              onClick={() => setTab("guest")}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                tab === "guest" ? "bg-navy-950 text-ivory-50" : "border border-navy-950/15 text-navy-700 hover:bg-navy-950/5"
              }`}
            >
              <Users size={12} /> As a Guest
            </button>
          </div>
          <ol className="grid gap-1.5 text-sm text-navy-700/80">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-gold-600">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

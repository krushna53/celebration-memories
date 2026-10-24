"use client";

import { useState } from "react";
import { HelpCircle, ChevronDown } from "lucide-react";

import type { GameType } from "@/types/games";

const INSTRUCTIONS: Record<GameType, { title: string; steps: string[] }> = {
  word_search: {
    title: "How to Play — Word Search",
    steps: [
      "Enter your name and phone number to start your own timer.",
      "Every word from the list is hidden in the grid — across, down, or diagonally, forwards or backwards.",
      "Click or tap the first letter of a word, then drag to its last letter to select it.",
      "A correct selection highlights gold and crosses the word off the list.",
      "Find every word as fast as you can — your time is recorded the moment you finish.",
    ],
  },
  housie: {
    title: "How to Play — Housie (Tambola)",
    steps: [
      "Enter your name and phone number to get your ticket — 15 numbers across 3 rows.",
      "The host calls numbers one at a time. Any number on your ticket is marked automatically as it's called.",
      "The moment you complete a prize, tap it to claim — the first valid claim for each prize wins it.",
      "Prizes, easiest to hardest: Early Five (any 5 marked), Top/Middle/Bottom Line (a full row), Full House (all 15).",
      "Claiming too early won't work — you'll just be told it's not complete yet, so no harm in trying.",
    ],
  },
  movie_housie: {
    title: "How to Play — Movie Name Housie",
    steps: [
      "Enter your name and phone number to get your card — a 5x5 grid of movie names.",
      "The host calls out movie names one at a time. Matching names on your card are marked automatically.",
      "Complete any full row, column, or diagonal for a Line win, or fill the whole card for Full House.",
      "Tap the prize to claim it the moment you complete it — first valid claim wins.",
    ],
  },
  bubble_pop: {
    title: "How to Play — Bubble Pop",
    steps: [
      "Type the player's name and a grown-up's phone number, then tap Let's play.",
      "Balloons with numbers float up the screen.",
      "Tap only the balloons with the magic number at the top — each one is a star!",
      "Other numbers just wobble. Pop as many as you can before the time runs out.",
    ],
  },
  animal_sounds: {
    title: "How to Play — Guess the Animal Sound",
    steps: [
      "Type the player's name and a grown-up's phone number, then tap Let's play.",
      "Turn the phone's sound up! The phone makes an animal's sound.",
      "Tap the animal that makes that sound. Tap “Hear it again” as many times as you like.",
      "Get as many right as you can — each one is a star.",
    ],
  },
  memory_match: {
    title: "How to Play — Photo Memory Match",
    steps: [
      "Type the player's name and a grown-up's phone number, then tap Let's play.",
      "Tap two cards to turn them over.",
      "If the photos match, they stay face up. If not, they flip back — try to remember where they were!",
      "Find all the pairs as fast as you can.",
    ],
  },
};

export function HowToPlay({ type }: { type: GameType }) {
  const [open, setOpen] = useState(false);
  const info = INSTRUCTIONS[type];

  return (
    <div className="mb-4 rounded-xl border border-gold-500/20 bg-gold-500/5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium text-navy-950"
      >
        <span className="flex items-center gap-1.5">
          <HelpCircle size={15} className="text-gold-600" /> {info.title}
        </span>
        <ChevronDown size={14} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>
      {open ? (
        <ol className="grid gap-1.5 border-t border-gold-500/15 px-4 py-3 text-sm text-navy-700/80">
          {info.steps.map((step, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-gold-600">{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

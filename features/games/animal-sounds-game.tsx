"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Volume2 } from "lucide-react";

import type { GameResult } from "@/features/games/solo-game-shell";
import type { AnimalSoundsConfig } from "@/types/games";

interface Animal {
  emoji: string;
  name: string;
  /** What the phone says — and the written fallback. */
  sound: string;
  /** Voice pitch 0–2: low for big animals, high for small ones. */
  pitch: number;
}

const ANIMALS: Animal[] = [
  { emoji: "🐶", name: "Dog", sound: "Woof woof!", pitch: 1 },
  { emoji: "🐱", name: "Cat", sound: "Meow! Meow!", pitch: 1.6 },
  { emoji: "🐄", name: "Cow", sound: "Mooooo!", pitch: 0.5 },
  { emoji: "🦆", name: "Duck", sound: "Quack quack!", pitch: 1.5 },
  { emoji: "🦁", name: "Lion", sound: "Roarrrr!", pitch: 0.3 },
  { emoji: "🐑", name: "Sheep", sound: "Baa baa!", pitch: 1.3 },
  { emoji: "🐷", name: "Pig", sound: "Oink oink!", pitch: 1.2 },
  { emoji: "🐓", name: "Rooster", sound: "Cock-a-doodle-doo!", pitch: 1.4 },
  { emoji: "🐴", name: "Horse", sound: "Neighhhh!", pitch: 1.1 },
  { emoji: "🐸", name: "Frog", sound: "Ribbit ribbit!", pitch: 0.9 },
  { emoji: "🐍", name: "Snake", sound: "Hissssss!", pitch: 1 },
  { emoji: "🦉", name: "Owl", sound: "Hoo hoo!", pitch: 0.8 },
  { emoji: "🐝", name: "Bee", sound: "Bzzzzzz!", pitch: 1.8 },
  { emoji: "🐒", name: "Monkey", sound: "Ooh ooh aah aah!", pitch: 1.5 },
];

function shuffle<T>(list: T[]): T[] {
  return list
    .map((v) => ({ v, k: Math.random() }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.v);
}

interface Round {
  answer: Animal;
  options: Animal[];
}

function makeRounds(count: number): Round[] {
  const answers = shuffle(ANIMALS).slice(0, Math.min(count, ANIMALS.length));
  return answers.map((answer) => ({
    answer,
    options: shuffle([answer, ...shuffle(ANIMALS.filter((a) => a !== answer)).slice(0, 3)]),
  }));
}

function canSpeak() {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

/**
 * Guess the Animal Sound: the phone "makes" an animal's sound with its
 * built-in voice when supported,
 * and the child taps the matching animal out of 4 big pictures. The sound
 * word is also shown when the phone can't speak, or after a wrong guess.
 * iPhones only allow speech after a tap, so round 1 starts with one.
 */
export function AnimalSoundsGame({ config, finish }: { config: AnimalSoundsConfig; finish: (r: GameResult) => void }) {
  const rounds = useMemo(() => makeRounds(config.rounds), [config.rounds]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [speechOk, setSpeechOk] = useState(canSpeak);
  const [showHint, setShowHint] = useState(false);
  const startedAt = useRef(Date.now());
  const scoreRef = useRef(0);
  const finishRef = useRef(finish);
  finishRef.current = finish;

  const round = rounds[index];

  function say(animal: Animal) {
    if (!speechOk) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(animal.sound);
    u.pitch = animal.pitch;
    u.rate = 0.85;
    u.volume = 1;
    u.lang = "en-US";
    u.onerror = () => setSpeechOk(false);
    synth.speak(u);
  }

  // Each new round plays its sound (after the first tap has unlocked speech).
  useEffect(() => {
    if (!unlocked || !round || index === 0) return;
    const t = setTimeout(() => say(round.answer), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, unlocked]);

  useEffect(() => () => {
    if (canSpeak()) window.speechSynthesis.cancel();
  }, []);

  function choose(animal: Animal) {
    if (!round || picked) return;
    setPicked(animal.name);
    const correct = animal.name === round.answer.name;
    if (correct) {
      scoreRef.current += 1;
      setScore(scoreRef.current);
      navigator.vibrate?.(30);
    }
    setTimeout(
      () => {
        setPicked(null);
        if (index + 1 >= rounds.length) {
          const s = scoreRef.current;
          finishRef.current({
            score: s,
            durationSeconds: Math.round((Date.now() - startedAt.current) / 1000),
            headline: `${s} out of ${rounds.length}!`,
            detail: s === rounds.length ? "Every animal right — amazing ears! 👂" : "Great listening!",
          });
        } else {
          setShowHint(false);
          setIndex((i) => i + 1);
        }
      },
      correct ? 1000 : 1700,
    );
  }

  if (!round) return null;

  if (!unlocked) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-3xl bg-white px-6 py-12 text-center shadow-sm">
        <p className="text-6xl">🐶 🐱 🦁 🐄</p>
        <p className="text-lg text-navy-950">Listen to the sound, then tap the animal that makes it!</p>
        <button
          type="button"
          onClick={() => {
            startedAt.current = Date.now();
            setUnlocked(true);
            say(round.answer);
          }}
          className="flex items-center gap-2 rounded-full bg-gold-500 px-8 py-4 text-xl font-semibold text-navy-950 hover:brightness-110"
        >
          <Volume2 size={24} /> Start listening
        </button>
        {!speechOk ? <p className="text-sm text-navy-700/60">(This phone can&rsquo;t talk, so the sound will be written instead.)</p> : null}
      </div>
    );
  }

  const answered = picked !== null;
  const wrong = answered && picked !== round.answer.name;

  return (
    <div className="select-none">
      <div className="mb-3 flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm">
        <p className="text-sm text-navy-700/70">
          Animal {index + 1} of {rounds.length}
        </p>
        <p className="text-2xl font-bold text-navy-950" aria-live="polite">⭐ {score}</p>
      </div>

      <div className="flex flex-col items-center gap-3 rounded-3xl bg-gradient-to-b from-emerald-100 to-ivory-50 px-4 py-6 text-center">
        <button
          type="button"
          onClick={() => say(round.answer)}
          className="flex items-center gap-2 rounded-full bg-white px-6 py-3 text-lg font-semibold text-navy-950 shadow hover:bg-ivory-50"
          aria-label="Play the sound again"
        >
          <Volume2 size={22} className="text-gold-600" /> Hear it again
        </button>
        {!speechOk || wrong || showHint ? <p className="text-2xl font-bold text-navy-950">&ldquo;{round.answer.sound}&rdquo;</p> : null}
        <button type="button" onClick={() => setShowHint(true)} className="text-sm underline">Show sound as text</button>
        <p className="text-base text-navy-700/80">Who says that?</p>

        <div className="mt-2 grid w-full grid-cols-2 gap-3">
          {round.options.map((animal) => {
            const isAnswer = animal.name === round.answer.name;
            const isPicked = picked === animal.name;
            return (
              <button
                key={animal.name}
                type="button"
                onClick={() => choose(animal)}
                disabled={answered}
                aria-label={animal.name}
                className={`flex aspect-square flex-col items-center justify-center rounded-3xl border-4 bg-white text-7xl shadow-sm transition-transform active:scale-95 ${
                  answered && isAnswer
                    ? "border-emerald-400 bg-emerald-50"
                    : isPicked
                      ? "border-red-300 bg-red-50"
                      : "border-transparent"
                }`}
              >
                <span aria-hidden="true">{animal.emoji}</span>
                <span className="mt-1 text-base font-medium text-navy-700">{animal.name}</span>
              </button>
            );
          })}
        </div>
        {answered ? (
          <p className="text-2xl font-bold" aria-live="polite">
            {wrong ? `It was the ${round.answer.name}! ${round.answer.emoji}` : "Yay! 🎉"}
          </p>
        ) : null}
      </div>
    </div>
  );
}

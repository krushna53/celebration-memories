"use client";

import { useEffect, useState } from "react";

/**
 * Captures a display name once per browser for the no-login planner
 * link (/plan/[token]) — purely cosmetic labeling ("Added by Priya",
 * "Rahul left a note"), not authentication. Stored in localStorage
 * keyed by token so switching between different events' planning links
 * on the same device doesn't mix up names. Renders nothing (returns
 * null) until the name is known, then hands it to `children`.
 */
export function NameGate({
  storageKey,
  children,
}: {
  storageKey: string;
  children: (name: string) => React.ReactNode;
}) {
  const [name, setName] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    setName(stored);
    setReady(true);
  }, [storageKey]);

  function save(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    window.localStorage.setItem(storageKey, trimmed);
    setName(trimmed);
  }

  if (!ready) return null;

  if (!name) {
    return (
      <div className="mx-auto max-w-sm rounded-2xl border border-gold-500/20 bg-white p-6 text-center shadow-sm">
        <p className="font-display text-lg text-navy-950">What&rsquo;s your name?</p>
        <p className="mt-1 text-sm text-navy-700/60">So the family knows who added what.</p>
        <form onSubmit={save} className="mt-4 flex gap-2">
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Your name"
            className="w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2 text-sm text-navy-950 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="shrink-0 rounded-lg bg-gold-500 px-4 py-2 text-sm font-medium text-navy-950 hover:brightness-110 disabled:opacity-60"
          >
            Continue
          </button>
        </form>
      </div>
    );
  }

  return (
    <>
      <p className="mb-4 text-center text-xs text-navy-700/50">
        Planning as <span className="font-medium text-navy-700">{name}</span> &middot;{" "}
        <button
          type="button"
          onClick={() => {
            window.localStorage.removeItem(storageKey);
            setName(null);
            setInput("");
          }}
          className="underline underline-offset-2 hover:text-navy-700"
        >
          not you?
        </button>
      </p>
      {children(name)}
    </>
  );
}

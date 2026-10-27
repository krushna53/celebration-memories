"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Loader2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPollOption, type DatePoll } from "@/lib/date-poll";
import { votePublicAction, voteWithInviteTokenAction } from "@/features/date-poll/actions";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

/** Remembers a public voter's name/phone/choices on this device, so coming back shows their vote. */
const STORAGE_PREFIX = "date-poll-vote:";

type Voter =
  | { kind: "invite"; token: string; guestName: string; initialChoices: string[] }
  | { kind: "public"; eventId: string };

interface StoredPublicVote {
  name: string;
  phone: string;
  choices: string[];
}

/**
 * Guest-facing date poll: tick every date that works, see who else picked
 * each one. Invite-link guests are already identified; public visitors
 * give their name and phone. Re-voting replaces the earlier choices.
 */
export function DatePollCard({ poll: initialPoll, voter }: { poll: DatePoll; voter: Voter }) {
  const [poll, setPoll] = useState(initialPoll);
  const [choices, setChoices] = useState<string[]>(voter.kind === "invite" ? voter.initialChoices : []);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [hasVoted, setHasVoted] = useState(voter.kind === "invite" && voter.initialChoices.length > 0);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const storageKey = voter.kind === "public" ? `${STORAGE_PREFIX}${voter.eventId}` : null;

  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const stored = JSON.parse(raw) as StoredPublicVote;
      setName(stored.name);
      setPhone(stored.phone);
      setChoices(stored.choices.filter((id) => initialPoll.options.some((o) => o.id === id)));
      setHasVoted(stored.choices.length > 0);
    } catch {
      // Private window / blocked storage — the form just starts empty.
    }
  }, [storageKey, initialPoll.options]);

  function toggle(optionId: string) {
    setMessage(null);
    setChoices((current) => (current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId]));
  }

  function submit() {
    setMessage(null);
    if (choices.length === 0 && !hasVoted) {
      setMessage({ ok: false, text: "Tick at least one date that works for you." });
      return;
    }
    startTransition(async () => {
      const result =
        voter.kind === "invite"
          ? await voteWithInviteTokenAction(voter.token, choices)
          : await votePublicAction(voter.eventId, { name, phone }, choices);
      if (!result.success) {
        setMessage({ ok: false, text: result.error });
        return;
      }
      setPoll(result.data);
      setHasVoted(choices.length > 0);
      setMessage({ ok: true, text: choices.length > 0 ? "Thank you — your vote is saved. You can change it any time." : "Your vote was removed." });
      if (storageKey) {
        try {
          window.localStorage.setItem(storageKey, JSON.stringify({ name, phone, choices } satisfies StoredPublicVote));
        } catch {
          // Not remembered on this device — the vote itself is saved.
        }
      }
    });
  }

  const topVotes = Math.max(0, ...poll.options.map((o) => o.voters.length));

  return (
    <div className="rounded-2xl border border-gold-500/20 bg-white p-5 shadow-sm sm:p-7">
      <p className="text-sm text-navy-700/75">
        {voter.kind === "invite" ? `${voter.guestName}, tick` : "Tick"} every date that works for you.
        {poll.voterCount > 0 ? ` ${poll.voterCount} ${poll.voterCount === 1 ? "person has" : "people have"} voted so far.` : ""}
      </p>

      <ul className="mt-5 grid gap-3" aria-label="Candidate dates">
        {poll.options.map((option) => {
          const { date, time } = formatPollOption(option, poll.timezone);
          const selected = choices.includes(option.id);
          const leading = topVotes > 0 && option.voters.length === topVotes;
          return (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => toggle(option.id)}
                aria-pressed={selected}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/50",
                  selected ? "border-gold-500 bg-gold-500/10" : "border-navy-950/10 bg-ivory-50 hover:border-gold-500/50",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                    selected ? "border-gold-600 bg-gold-500 text-white" : "border-navy-950/25 bg-white",
                  )}
                >
                  {selected ? <Check size={14} strokeWidth={3} /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-navy-950">{date}</span>
                  <span className="block text-sm text-navy-700/70">
                    {time}
                    {option.label ? ` · ${option.label}` : ""}
                  </span>
                  {option.voters.length > 0 ? (
                    <span className="mt-2 block text-xs leading-relaxed text-navy-700/70">
                      <Users size={12} className="mr-1 inline align-[-1px] text-gold-600" aria-hidden="true" />
                      {option.voters.map((v) => v.name).join(", ")}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-display text-xl text-navy-950">{option.voters.length}</span>
                  <span className="block text-[10px] uppercase tracking-[0.15em] text-navy-700/55">
                    {leading ? "Most votes" : option.voters.length === 1 ? "vote" : "votes"}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {voter.kind === "public" ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-xs font-medium uppercase tracking-[0.15em] text-navy-700/70">
            Your name
            <input className={inputClasses} value={name} maxLength={80} autoComplete="name" onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="grid gap-1.5 text-xs font-medium uppercase tracking-[0.15em] text-navy-700/70">
            Phone
            <input
              className={inputClasses}
              value={phone}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              maxLength={30}
              placeholder="+91 98765 43210"
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <p className="text-xs text-navy-700/55 sm:col-span-2">
            Your name is shown next to the dates you pick. Your phone number is never shown to other guests.
          </p>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button type="button" onClick={submit} disabled={pending}>
          {pending ? <Loader2 size={16} className="animate-spin" /> : null}
          {hasVoted ? "Update my vote" : "Save my vote"}
        </Button>
        {message ? (
          <p className={message.ok ? "text-sm text-green-700" : "text-sm text-red-600"} role="status">
            {message.text}
          </p>
        ) : null}
      </div>
    </div>
  );
}

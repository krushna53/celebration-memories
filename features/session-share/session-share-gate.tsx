"use client";

import { type FormEvent, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";

import { verifySessionShareAccessAction } from "@/features/session-share/actions";
import { SessionRegisterButton } from "@/features/event-day/session-register-button";
import { computeSessionPrice } from "@/lib/rsvp-pricing";
import type { ScheduleItemRecord } from "@/types/content";

const inputClasses =
  "w-full rounded-lg border border-gold-500/25 bg-navy-900/40 px-3 py-2.5 text-sm text-ivory-50 placeholder:text-ivory-100/40 focus:border-gold-400 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

interface VerifiedData {
  eventId: string;
  inviteeId: string;
  eventTitle: string;
  session: ScheduleItemRecord;
  alreadyRegistered: boolean;
  customFormSlug: string | null;
}

/**
 * Phone-verification gate for the public, per-session /session/[token]
 * page (#106) — the single-session sibling of
 * features/event-day/event-day-gate.tsx. Shared by a session organizer
 * with just their own guests instead of the event's full Event Day
 * link, e.g. for one paid workshop slot.
 */
export function SessionShareGate({ token, honoreeName }: { token: string; honoreeName: string }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState<VerifiedData | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await verifySessionShareAccessAction(token, name, phone);
    setBusy(false);
    if (result.success) {
      setVerified({
        eventId: result.data.eventId,
        inviteeId: result.data.inviteeId,
        eventTitle: result.data.eventTitle,
        session: result.data.session,
        alreadyRegistered: result.data.alreadyRegistered,
        customFormSlug: result.data.customFormSlug,
      });
    } else {
      setError(result.error);
    }
  }

  if (verified) {
    const { session } = verified;
    const price = computeSessionPrice(session);

    return (
      <div className="flex justify-center bg-navy-950 px-4 pb-24 pt-28 sm:pt-32">
        <div className="w-full max-w-md rounded-2xl border border-gold-500/20 bg-navy-900/60 p-6 text-center shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-gold-300/90">{honoreeName}</p>
          <h1 className="mt-2 font-display text-xl text-ivory-50">{verified.eventTitle}</h1>

          <div className="mt-6 rounded-xl border border-gold-500/15 bg-navy-950/40 p-4 text-left">
            <p className="text-xs uppercase tracking-[0.3em] text-gold-300/90">
              {session.startLabel}
              {session.endLabel ? ` – ${session.endLabel}` : ""}
            </p>
            <h2 className="mt-2 font-display text-lg text-ivory-50">{session.title}</h2>
            {session.description ? <p className="mt-2 text-sm leading-relaxed text-ivory-100/70">{session.description}</p> : null}

            {session.requiresRegistration ? (
              <SessionRegisterButton
                eventId={verified.eventId}
                scheduleItemId={session.id}
                inviteeId={verified.inviteeId}
                returnPath={`/session/${token}`}
                price={price}
                initiallyRegistered={verified.alreadyRegistered}
              />
            ) : (
              <p className="mt-3 text-xs text-ivory-100/50">This session doesn&rsquo;t need registration — just come along.</p>
            )}

            {verified.customFormSlug ? (
              <a
                href={`/f/${verified.customFormSlug}`}
                target="_blank"
                rel="noreferrer"
                className="mt-4 flex items-center gap-1.5 text-xs font-medium text-gold-300 hover:text-gold-200"
              >
                <ExternalLink size={13} /> A few extra questions from the host
              </a>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center bg-navy-950 px-4 pb-24 pt-28 sm:pt-32">
      <div className="w-full max-w-sm rounded-2xl border border-gold-500/20 bg-navy-900/60 p-6 text-center shadow-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-gold-300/90">{honoreeName}</p>
        <h1 className="mt-2 font-display text-xl text-ivory-50">Session Registration</h1>
        <p className="mt-2 text-sm text-ivory-100/60">
          Enter your name and phone number to continue — if you&rsquo;re on the guest list, we&rsquo;ll recognize you.
        </p>
        <form onSubmit={handleSubmit} className="mt-5 grid gap-2.5 text-left">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className={inputClasses} />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Your phone number"
            className={inputClasses}
          />
          {error ? <p className="text-xs text-rose-300">{error}</p> : null}
          <button
            type="submit"
            disabled={busy || !name.trim() || !phone.trim()}
            className="mt-1 flex items-center justify-center gap-1.5 rounded-full bg-gold-500 px-4 py-2.5 text-sm font-medium text-navy-950 hover:brightness-110 disabled:opacity-60"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : null} Continue
          </button>
        </form>
      </div>
    </div>
  );
}

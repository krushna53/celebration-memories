"use client";

import { SessionRegisterButton } from "@/features/event-day/session-register-button";
import { computeSessionPrice } from "@/lib/rsvp-pricing";
import type { ScheduleItemRecord } from "@/types/content";

/**
 * "Would you like to join a session?" step (#106) shown right after a
 * "coming" RSVP, for events that have one or more Event Day sessions
 * needing registration (e.g. a multi-track workshop) — the standalone
 * RSVP's own entry point into the same session system Event Day and
 * /session/[token] already use. Reuses SessionRegisterButton unchanged,
 * just wrapped in a dark card here since that component is styled for
 * a dark background (matching /event-day, where it's normally shown).
 */
export function WorkshopSessionPicker({
  eventId,
  inviteeId,
  sessions,
  returnPath,
}: {
  eventId: string;
  inviteeId: string;
  sessions: ScheduleItemRecord[];
  returnPath: string;
}) {
  return (
    <div className="rounded-2xl border border-gold-500/20 bg-navy-950 p-5">
      <p className="text-xs uppercase tracking-[0.25em] text-gold-300/90">Join A Session</p>
      <p className="mt-1.5 text-sm text-ivory-100/70">Optional — register for any sessions you&rsquo;d like to attend.</p>

      <div className="mt-4 grid gap-4">
        {sessions.map((session) => (
          <div key={session.id} className="rounded-xl border border-gold-500/10 bg-navy-900/40 p-3.5">
            <p className="text-xs uppercase tracking-[0.2em] text-gold-300/80">
              {session.startLabel}
              {session.endLabel ? ` – ${session.endLabel}` : ""}
            </p>
            <p className="mt-1 font-display text-base text-ivory-50">{session.title}</p>
            {session.description ? <p className="mt-1 text-xs text-ivory-100/60">{session.description}</p> : null}
            <SessionRegisterButton
              eventId={eventId}
              scheduleItemId={session.id}
              inviteeId={inviteeId}
              returnPath={returnPath}
              price={computeSessionPrice(session)}
              initiallyRegistered={false}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

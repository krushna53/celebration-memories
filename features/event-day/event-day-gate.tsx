"use client";

import { type FormEvent, useState } from "react";
import { Loader2 } from "lucide-react";

import { verifyEventDayAccessAction } from "@/features/event-day/actions";
import { EventDaySection } from "@/features/event-day/event-day-section";
import type { MenuItemRecord, MenuStyle, ScheduleItemRecord } from "@/types/content";

const inputClasses =
  "w-full rounded-lg border border-gold-500/25 bg-navy-900/40 px-3 py-2.5 text-sm text-ivory-50 placeholder:text-ivory-100/40 focus:border-gold-400 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

interface EventDayGateProps {
  token: string;
  honoreeName: string;
}

interface VerifiedData {
  eventTitle: string;
  menuStyle: MenuStyle;
  scheduleItems: ScheduleItemRecord[];
  menuItems: MenuItemRecord[];
}

/**
 * Phone-verification gate for the private /event-day/[token] page —
 * same "type your name and phone, we check it against the guest list"
 * pattern as the Games identify screen (see word-search-game.tsx), just
 * check-only rather than creating/joining anything.
 */
export function EventDayGate({ token, honoreeName }: EventDayGateProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState<VerifiedData | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await verifyEventDayAccessAction(token, name, phone);
    setBusy(false);
    if (result.success) {
      setVerified({
        eventTitle: result.data.eventTitle,
        menuStyle: result.data.menuStyle,
        scheduleItems: result.data.scheduleItems,
        menuItems: result.data.menuItems,
      });
    } else {
      setError(result.error);
    }
  }

  if (verified) {
    return (
      <div className="bg-navy-950 pb-24 pt-28 sm:pt-32">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-gold-300/90">{honoreeName}</p>
          <h1 className="mt-2 font-display text-2xl text-ivory-50 sm:text-3xl">{verified.eventTitle}</h1>
        </div>
        <div className="mt-12">
          <EventDaySection
            scheduleItems={verified.scheduleItems}
            menuItems={verified.menuItems}
            menuStyle={verified.menuStyle}
            asHomepageSection={false}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center bg-navy-950 px-4 pb-24 pt-28 sm:pt-32">
      <div className="w-full max-w-sm rounded-2xl border border-gold-500/20 bg-navy-900/60 p-6 text-center shadow-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-gold-300/90">{honoreeName}</p>
        <h1 className="mt-2 font-display text-xl text-ivory-50">Event Schedule &amp; Menu</h1>
        <p className="mt-2 text-sm text-ivory-100/60">
          Enter your name and phone number to view — if you&rsquo;re on the guest list, we&rsquo;ll recognize you.
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
            {busy ? <Loader2 size={14} className="animate-spin" /> : null} View Schedule &amp; Menu
          </button>
        </form>
      </div>
    </div>
  );
}

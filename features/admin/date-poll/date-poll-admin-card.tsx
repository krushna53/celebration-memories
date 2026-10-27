"use client";

import { useState, useTransition } from "react";
import { CalendarCheck, Loader2, Plus, Trash2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatPollOption, MAX_POLL_OPTIONS, type DatePoll } from "@/lib/date-poll";
import { utcIsoToZonedInputValue } from "@/lib/timezone";
import {
  finaliseDatePollAction,
  saveDatePollOptionsAction,
  setDatePollOpenAction,
} from "@/features/admin/date-poll/actions";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";
const labelClasses = "grid gap-1.5 text-xs font-medium uppercase tracking-[0.15em] text-navy-700/70";

interface DraftOption {
  /** Saved option id — kept so its votes survive edits. */
  id?: string;
  /** Local key for React lists before an option is saved. */
  key: string;
  start: string;
  end: string;
  label: string;
}

function toDrafts(poll: DatePoll): DraftOption[] {
  return poll.options.map((option) => ({
    id: option.id,
    key: option.id,
    start: utcIsoToZonedInputValue(option.startAt, poll.timezone),
    end: option.endAt ? utcIsoToZonedInputValue(option.endAt, poll.timezone) : "",
    label: option.label ?? "",
  }));
}

let draftCounter = 0;
function emptyDraft(): DraftOption {
  draftCounter += 1;
  return { key: `new-${draftCounter}`, start: "", end: "", label: "" };
}

/**
 * Event Settings card for the date poll (services/date-poll.ts): list a few
 * candidate dates, open voting, watch who picks what, then finalise one —
 * which becomes the event's real date everywhere and closes the poll.
 */
export function DatePollAdminCard({ eventId, eventSlug, initialPoll }: { eventId: string; eventSlug: string; initialPoll: DatePoll }) {
  const [poll, setPoll] = useState(initialPoll);
  const [drafts, setDrafts] = useState<DraftOption[]>(() => {
    const saved = toDrafts(initialPoll);
    return saved.length > 0 ? saved : [emptyDraft(), emptyDraft()];
  });
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function updateDraft(key: string, patch: Partial<DraftOption>) {
    setDirty(true);
    setMessage(null);
    setDrafts((current) => current.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }

  function removeDraft(key: string) {
    setDirty(true);
    setMessage(null);
    setDrafts((current) => current.filter((d) => d.key !== key));
  }

  function applyResult(result: Awaited<ReturnType<typeof setDatePollOpenAction>>, okText: string): boolean {
    if (!result.success) {
      setMessage({ ok: false, text: result.error });
      return false;
    }
    setPoll(result.data);
    setDrafts(toDrafts(result.data));
    setDirty(false);
    setMessage({ ok: true, text: okText });
    return true;
  }

  function saveDates() {
    setMessage(null);
    const filled = drafts.filter((d) => d.start);
    startTransition(async () => {
      const result = await saveDatePollOptionsAction(
        eventId,
        filled.map((d) => ({ id: d.id, start: d.start, end: d.end || null, label: d.label.trim() || null })),
      );
      applyResult(result, "Dates saved.");
    });
  }

  function toggleOpen(open: boolean) {
    if (!open && !window.confirm("Stop voting without picking a date? The event will keep its current placeholder date until you change it.")) return;
    if (dirty) {
      setMessage({ ok: false, text: "Save your dates first." });
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const result = await setDatePollOpenAction(eventId, open);
      applyResult(result, open ? "Voting is open — guests now see “Pick a Date” on the event page and their invite links." : "Voting closed.");
    });
  }

  function finalise(optionId: string) {
    const option = poll.options.find((o) => o.id === optionId);
    if (!option) return;
    const { date, time } = formatPollOption(option, poll.timezone);
    if (!window.confirm(`Make ${date}, ${time} the event date and close voting?`)) return;
    setMessage(null);
    startTransition(async () => {
      const result = await finaliseDatePollAction(eventId, optionId);
      if (applyResult(result, "Date finalised.")) {
        // The Event Settings form above holds its own copy of the date — reload so it shows the finalised one.
        window.location.reload();
      }
    });
  }

  const topVotes = Math.max(0, ...poll.options.map((o) => o.voters.length));

  return (
    <section className="mt-8 rounded-xl border border-navy-950/10 bg-white p-5 shadow-sm" id="date-poll-settings">
      <h2 className="font-display text-lg text-navy-950">Date poll</h2>
      <p className="mt-1 max-w-2xl text-sm text-navy-700/65">
        Not sure of the date yet? List a few options and let guests tick the ones that work for them. While voting is open, the
        event page and every invite link show &ldquo;Date to be decided&rdquo; with a <strong>Pick a Date</strong> section, and
        everyone can see who voted for which date. When you&rsquo;re ready, finalise one — it becomes the event date everywhere.
      </p>

      <label className="mt-4 flex items-start gap-2.5 text-sm text-navy-950">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-gold-500"
          checked={poll.open}
          disabled={pending}
          onChange={(e) => toggleOpen(e.target.checked)}
        />
        <span>
          Let guests vote on the date
          <span className="block text-xs text-navy-700/60">Needs at least two saved dates.</span>
        </span>
      </label>

      <div className="mt-5 grid gap-3">
        {drafts.map((draft, index) => (
          <div key={draft.key} className="grid gap-3 rounded-lg border border-navy-950/10 bg-ivory-50 p-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
            <label className={labelClasses}>
              Option {index + 1} starts
              <input type="datetime-local" className={inputClasses} value={draft.start} onChange={(e) => updateDraft(draft.key, { start: e.target.value })} />
            </label>
            <label className={labelClasses}>
              Ends (optional)
              <input type="datetime-local" className={inputClasses} value={draft.end} onChange={(e) => updateDraft(draft.key, { end: e.target.value })} />
            </label>
            <label className={labelClasses}>
              Note (optional)
              <input
                className={inputClasses}
                value={draft.label}
                maxLength={80}
                placeholder="e.g. Lunch"
                onChange={(e) => updateDraft(draft.key, { label: e.target.value })}
              />
            </label>
            <Button type="button" variant="ghost" onClick={() => removeDraft(draft.key)} aria-label={`Remove option ${index + 1}`} disabled={pending}>
              <Trash2 size={16} />
            </Button>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-navy-700/55">
        Times are in the event&rsquo;s timezone ({poll.timezone}). Removing a date also removes its votes.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setDirty(true);
            setDrafts((current) => [...current, emptyDraft()]);
          }}
          disabled={pending || drafts.length >= MAX_POLL_OPTIONS}
        >
          <Plus size={16} /> Add a date
        </Button>
        <Button type="button" onClick={saveDates} disabled={pending || !dirty}>
          {pending ? <Loader2 size={16} className="animate-spin" /> : null}
          Save dates
        </Button>
        {message ? (
          <p className={message.ok ? "text-sm text-green-700" : "text-sm text-red-600"} role="status">
            {message.text}
          </p>
        ) : null}
      </div>

      {poll.options.length > 0 ? (
        <div className="mt-6 border-t border-navy-950/10 pt-5">
          <h3 className="text-sm font-medium text-navy-950">
            Votes so far · {poll.voterCount} {poll.voterCount === 1 ? "person" : "people"}
          </h3>
          {poll.open ? (
            <p className="mt-1 text-xs text-navy-700/60">
              Share{" "}
              <a href={`/events/${eventSlug}#date-poll`} target="_blank" rel="noopener noreferrer" className="text-gold-600 underline underline-offset-2">
                /events/{eventSlug}#date-poll
              </a>{" "}
              or guests&rsquo; personal invite links — both show the poll.
            </p>
          ) : null}
          <ul className="mt-3 grid gap-2">
            {poll.options.map((option) => {
              const { date, time } = formatPollOption(option, poll.timezone);
              const leading = topVotes > 0 && option.voters.length === topVotes;
              return (
                <li key={option.id} className={`flex flex-wrap items-start gap-3 rounded-lg border p-3 ${leading ? "border-gold-500/60 bg-gold-500/5" : "border-navy-950/10"}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-navy-950">
                      {date}
                      {leading ? <span className="ml-2 rounded-full bg-gold-500/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gold-700">Most votes</span> : null}
                    </p>
                    <p className="text-xs text-navy-700/65">
                      {time}
                      {option.label ? ` · ${option.label}` : ""}
                    </p>
                    <p className="mt-1.5 text-xs text-navy-700/75">
                      <Users size={12} className="mr-1 inline align-[-1px] text-gold-600" aria-hidden="true" />
                      {option.voters.length} {option.voters.length === 1 ? "vote" : "votes"}
                      {option.voters.length > 0 ? ` — ${option.voters.map((v) => v.name).join(", ")}` : ""}
                    </p>
                  </div>
                  {poll.open ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => finalise(option.id)} disabled={pending || dirty}>
                      <CalendarCheck size={14} /> Finalise this date
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

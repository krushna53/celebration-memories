"use client";

import { useState, useTransition } from "react";
import { Loader2, Mail, KeyRound, UserMinus, UserPlus, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { SessionOrganizer } from "@/services/session-organizers";
import type { ScheduleItemRecord } from "@/types/content";
import {
  addSessionOrganizerWithPasswordAction,
  inviteSessionOrganizerAction,
  removeSessionOrganizerAction,
} from "@/features/admin/session-organizers/actions";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";
const labelClasses = "text-xs font-medium uppercase tracking-[0.15em] text-navy-700/70";

interface SessionOrganizerManagerProps {
  eventId: string;
  scheduleItems: ScheduleItemRecord[];
  initialOrganizers: SessionOrganizer[];
}

function sessionLabel(item: ScheduleItemRecord): string {
  return `${item.startLabel}${item.endLabel ? `–${item.endLabel}` : ""} · ${item.title}`;
}

/**
 * Client-facing (or owner, stepped into an event) management page for
 * the #63 session_organizer role — narrower than features/admin/team/
 * team-manager.tsx's full-access team members: each organizer is scoped
 * to one or more specific Event Day sessions (session_organizer_assignments)
 * and can only view that session's attendee list + payments on
 * /admin/my-sessions, never anything else about the event.
 */
export function SessionOrganizerManager({ eventId, scheduleItems, initialOrganizers }: SessionOrganizerManagerProps) {
  const [organizers, setOrganizers] = useState(initialOrganizers);
  const [showAddForm, setShowAddForm] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function sessionTitlesFor(organizer: SessionOrganizer): string {
    const titles = organizer.sessionIds
      .map((id) => scheduleItems.find((s) => s.id === id))
      .filter((s): s is ScheduleItemRecord => Boolean(s))
      .map((s) => s.title);
    return titles.length > 0 ? titles.join(", ") : "No sessions assigned";
  }

  function handleRemove(organizer: SessionOrganizer) {
    if (!confirm(`Remove dashboard access for ${organizer.name || organizer.email}? They'll be signed out immediately.`)) {
      return;
    }
    setListError(null);
    setBusyId(organizer.id);
    startTransition(async () => {
      const result = await removeSessionOrganizerAction(eventId, organizer.id);
      setBusyId(null);
      if (result.success) {
        setOrganizers((prev) => prev.filter((o) => o.id !== organizer.id));
      } else {
        setListError(result.error);
      }
    });
  }

  if (scheduleItems.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-navy-950/15 bg-white p-6 text-sm text-navy-700/60">
        Add sessions under Event Day first — session organizers are assigned to specific schedule items.
      </p>
    );
  }

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-navy-950/10 bg-white">
        <table className="stack-table w-full text-left text-sm">
          <thead className="bg-navy-950/5 text-xs uppercase tracking-wide text-navy-700/60">
            <tr>
              <th className="px-4 py-3">Organizer</th>
              <th className="px-4 py-3">Assigned Sessions</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-950/5">
            {organizers.map((organizer) => (
              <tr key={organizer.id}>
                <td className="px-4 py-3">
                  <div className="font-medium text-navy-950">{organizer.name || "—"}</div>
                  <div className="text-xs text-navy-700/50">{organizer.email}</div>
                </td>
                <td data-label="Assigned Sessions" className="px-4 py-3 text-navy-700/70">{sessionTitlesFor(organizer)}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    disabled={busyId === organizer.id}
                    onClick={() => handleRemove(organizer)}
                    className="inline-flex items-center gap-1 text-xs text-navy-700/60 hover:text-red-600 disabled:opacity-50"
                  >
                    {busyId === organizer.id ? <Loader2 size={13} className="animate-spin" /> : <UserMinus size={13} />}
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {organizers.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-sm text-navy-700/50">
                  No session organizers yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {listError ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {listError}
        </p>
      ) : null}

      {showAddForm ? (
        <AddOrganizerForm
          eventId={eventId}
          scheduleItems={scheduleItems}
          onClose={() => setShowAddForm(false)}
          onAdded={(organizer) => {
            setOrganizers((prev) => [...prev, organizer]);
            setShowAddForm(false);
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="tap-target mt-4 flex items-center gap-2 rounded-full border border-gold-500/40 px-4 py-2 text-sm font-medium text-gold-700 transition-luxury duration-200 hover:border-gold-500 hover:bg-gold-500/5"
        >
          <UserPlus size={16} />
          Add a Session Organizer
        </button>
      )}
    </div>
  );
}

function AddOrganizerForm({
  eventId,
  scheduleItems,
  onClose,
  onAdded,
}: {
  eventId: string;
  scheduleItems: ScheduleItemRecord[];
  onClose: () => void;
  onAdded: (organizer: SessionOrganizer) => void;
}) {
  const [method, setMethod] = useState<"invite" | "password">("invite");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleSession(id: string) {
    setSelectedSessions((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (selectedSessions.length === 0) {
      setError("Please select at least one session.");
      return;
    }
    setSubmitting(true);

    const result =
      method === "invite"
        ? await inviteSessionOrganizerAction(eventId, name, email, selectedSessions)
        : await addSessionOrganizerWithPasswordAction(eventId, name, email, password, selectedSessions);

    setSubmitting(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    onAdded({
      id: `pending-${Date.now()}`,
      name: name.trim(),
      email: email.trim(),
      createdAt: new Date().toISOString(),
      sessionIds: selectedSessions,
    });
  }

  return (
    <div className="mt-4 rounded-xl border border-gold-500/20 bg-gold-500/5 p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base text-navy-950">Add a Session Organizer</h3>
        <button type="button" onClick={onClose} aria-label="Cancel" className="tap-target text-navy-700/50 hover:text-navy-950">
          <X size={16} />
        </button>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => setMethod("invite")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-luxury duration-200",
            method === "invite" ? "border-gold-500 bg-gold-500/10 text-navy-950" : "border-navy-950/15 text-navy-700/60",
          )}
        >
          <Mail size={13} /> Send Invite Email
        </button>
        <button
          type="button"
          onClick={() => setMethod("password")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-luxury duration-200",
            method === "password" ? "border-gold-500 bg-gold-500/10 text-navy-950" : "border-navy-950/15 text-navy-700/60",
          )}
        >
          <KeyRound size={13} /> Set Password Myself
        </button>
      </div>

      <form onSubmit={onSubmit} className="mt-4 grid gap-3">
        <div>
          <label className={labelClasses} htmlFor="organizer-name">
            Name
          </label>
          <input id="organizer-name" required value={name} onChange={(e) => setName(e.target.value)} className={`${inputClasses} mt-1.5`} />
        </div>
        <div>
          <label className={labelClasses} htmlFor="organizer-email">
            Email
          </label>
          <input
            id="organizer-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`${inputClasses} mt-1.5`}
          />
        </div>
        {method === "password" ? (
          <div>
            <label className={labelClasses} htmlFor="organizer-password">
              Password
            </label>
            <input
              id="organizer-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputClasses} mt-1.5`}
            />
          </div>
        ) : null}

        <div>
          <label className={labelClasses}>Sessions they can see</label>
          <div className="mt-1.5 grid gap-1.5 rounded-lg border border-navy-950/15 bg-white p-2.5">
            {scheduleItems.map((item) => (
              <label key={item.id} className="flex items-center gap-2 text-sm text-navy-950">
                <input type="checkbox" checked={selectedSessions.includes(item.id)} onChange={() => toggleSession(item.id)} />
                {sessionLabel(item)}
              </label>
            ))}
          </div>
        </div>

        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="mt-1 flex items-center justify-center gap-2 rounded-full bg-gold-500 px-5 py-2.5 text-sm font-medium text-navy-950 transition-luxury duration-200 hover:brightness-110 disabled:opacity-60"
        >
          {submitting ? <Loader2 className="animate-spin" size={16} /> : method === "invite" ? "Send Invite" : "Add Organizer"}
        </button>
      </form>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { Loader2, Mail, KeyRound, UserMinus, UserPlus, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Organizer } from "@/services/organizers";
import {
  addOrganizerWithPasswordAction,
  inviteOrganizerAction,
  removeOrganizerAction,
} from "@/features/admin/organizers/actions";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";
const labelClasses = "text-xs font-medium uppercase tracking-[0.15em] text-navy-700/70";

interface OrganizerManagerProps {
  eventId: string;
  initialOrganizers: Organizer[];
}

/**
 * Client-facing (or owner, stepped into an event) management page for
 * the #105 "organizer" role — broader than session_organizer's
 * SessionOrganizerManager (no session picker; an organizer manages the
 * whole event's Invitees, Gallery, Timeline, and Check-In, not a
 * specific Event Day session) but narrower than a full team member
 * (features/admin/team/team-manager.tsx): no Event Settings, billing,
 * or AI tools access, and an organizer can't manage other organizers.
 */
export function OrganizerManager({ eventId, initialOrganizers }: OrganizerManagerProps) {
  const [organizers, setOrganizers] = useState(initialOrganizers);
  const [showAddForm, setShowAddForm] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleRemove(organizer: Organizer) {
    if (!confirm(`Remove dashboard access for ${organizer.name || organizer.email}? They'll be signed out immediately.`)) {
      return;
    }
    setListError(null);
    setBusyId(organizer.id);
    startTransition(async () => {
      const result = await removeOrganizerAction(eventId, organizer.id);
      setBusyId(null);
      if (result.success) {
        setOrganizers((prev) => prev.filter((o) => o.id !== organizer.id));
      } else {
        setListError(result.error);
      }
    });
  }

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-navy-950/10 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-navy-950/5 text-xs uppercase tracking-wide text-navy-700/60">
            <tr>
              <th className="px-4 py-3">Organizer</th>
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
                <td colSpan={2} className="px-4 py-6 text-center text-sm text-navy-700/50">
                  No organizers yet.
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
          Add an Organizer
        </button>
      )}
    </div>
  );
}

function AddOrganizerForm({
  eventId,
  onClose,
  onAdded,
}: {
  eventId: string;
  onClose: () => void;
  onAdded: (organizer: Organizer) => void;
}) {
  const [method, setMethod] = useState<"invite" | "password">("invite");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const result =
      method === "invite"
        ? await inviteOrganizerAction(eventId, name, email)
        : await addOrganizerWithPasswordAction(eventId, name, email, password);

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
    });
  }

  return (
    <div className="mt-4 rounded-xl border border-gold-500/20 bg-gold-500/5 p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base text-navy-950">Add an Organizer</h3>
        <button type="button" onClick={onClose} aria-label="Cancel" className="tap-target text-navy-700/50 hover:text-navy-950">
          <X size={16} />
        </button>
      </div>
      <p className="mt-1.5 text-xs text-navy-700/60">
        They&rsquo;ll get a dashboard login scoped to Invitees, Gallery, Timeline, and Check-In only — nothing else about
        this event.
      </p>

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

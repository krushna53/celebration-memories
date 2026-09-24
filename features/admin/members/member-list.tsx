"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Crown, KeyRound, Loader2, Mail, Trash2, UserMinus, UserPlus, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  removeAdminAccessAction,
  deleteAdminAccountAction,
  addMemberByInviteAction,
  addMemberWithPasswordAction,
} from "@/features/admin/members/actions";
import type { AdminUserSummary } from "@/services/admin-users";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-400/30";
const addFormInputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";
const labelClasses = "text-xs font-medium uppercase tracking-[0.15em] text-navy-700/70";

export interface EventOption {
  id: string;
  label: string;
}

/**
 * Owner-only list of every dashboard-login account (app/admin/(dashboard)
 * /members) — distinct from Invitees, which is event guests with no
 * login at all. Client-role rows get two destructive actions:
 *
 * - "Remove Access" — reversible, just deletes the `admins` row (see
 *   services/admin-users.ts's deleteAdminAccess). Keeps their event and
 *   its data untouched.
 * - "Delete Permanently" — irreversible, deletes their login AND their
 *   event with everything in it (see services/admin-danger-zone.ts's
 *   deleteAdminAccountAndAssets). Gated behind typing the account's own
 *   email to confirm.
 *
 * Owner accounts get neither. An "Add Member" form lets the owner grant
 * a new client login to any event right from this page (previously this
 * required visiting that event's row on /admin/events instead) — see
 * AddMemberForm below, which reuses the same invite-email/set-password
 * mechanism (and per-event 4-member cap) as a client's own /admin/team.
 */
export function MemberList({
  initialMembers,
  events,
}: {
  initialMembers: AdminUserSummary[];
  events: EventOption[];
}) {
  const [members, setMembers] = useState(initialMembers);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUserSummary | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [, startTransition] = useTransition();

  function remove(id: string, label: string) {
    if (
      !confirm(
        `Remove dashboard access for "${label}"? Their login stops working immediately. This doesn't delete their account — you can restore access later (see the README).`,
      )
    ) {
      return;
    }
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      const result = await removeAdminAccessAction(id);
      setBusyId(null);
      if (result.success) {
        setMembers((prev) => prev.filter((m) => m.id !== id));
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div>
      {error ? (
        <p className="mb-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <div className="overflow-hidden rounded-xl border border-navy-950/10 bg-white">
        <table className="stack-table w-full text-left text-sm">
          <thead className="bg-navy-950/5 text-xs uppercase tracking-wide text-navy-700/60">
            <tr>
              <th className="px-4 py-3">Member</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-950/5">
            {members.map((member) => (
              <tr key={member.id}>
                <td className="px-4 py-3">
                  <div className="font-medium text-navy-950">{member.name || "—"}</div>
                  <div className="text-xs text-navy-700/50">{member.email}</div>
                </td>
                <td data-label="Role" className="px-4 py-3">
                  {member.role === "owner" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gold-500/10 px-2.5 py-1 text-xs font-medium text-gold-700">
                      <Crown size={11} /> Owner
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-navy-950/5 px-2.5 py-1 text-xs font-medium text-navy-700">
                      Client
                    </span>
                  )}
                </td>
                <td data-label="Event" className="px-4 py-3 text-navy-700/70">{member.eventLabel ?? "—"}</td>
                <td data-label="Joined" className="px-4 py-3 text-navy-700/70">
                  {new Date(member.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </td>
                <td className="px-4 py-3 text-right">
                  {member.role === "client" ? (
                    <div className="flex items-center justify-end gap-3">
                      <button
                        type="button"
                        disabled={busyId === member.id}
                        onClick={() => remove(member.id, member.name || member.email)}
                        className="inline-flex items-center gap-1 text-xs text-navy-700/60 hover:text-navy-950 disabled:opacity-50"
                      >
                        {busyId === member.id ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <UserMinus size={13} />
                        )}
                        Remove Access
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(member)}
                        className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
                      >
                        <Trash2 size={13} /> Delete Permanently
                      </button>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {deleteTarget ? (
        <DeleteAccountDialog
          member={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setMembers((prev) => prev.filter((m) => m.id !== deleteTarget.id));
            setDeleteTarget(null);
          }}
        />
      ) : null}

      {showAddForm ? (
        <AddMemberForm
          events={events}
          onClose={() => setShowAddForm(false)}
          onAdded={(member) => {
            setMembers((prev) => [...prev, member]);
            setShowAddForm(false);
          }}
        />
      ) : (
        <button
          type="button"
          disabled={events.length === 0}
          onClick={() => setShowAddForm(true)}
          className="tap-target mt-4 flex items-center gap-2 rounded-full border border-gold-500/40 px-4 py-2 text-sm font-medium text-gold-700 transition-luxury duration-200 hover:border-gold-500 hover:bg-gold-500/5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <UserPlus size={16} />
          {events.length === 0 ? "No events yet — create one first" : "Add Member"}
        </button>
      )}
    </div>
  );
}

function DeleteAccountDialog({
  member,
  onClose,
  onDeleted,
}: {
  member: AdminUserSummary;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const matches = confirmText.trim().toLowerCase() === member.email.trim().toLowerCase();

  async function handleDelete() {
    if (!matches) return;
    setDeleting(true);
    setError(null);
    const result = await deleteAdminAccountAction(member.id, confirmText);
    setDeleting(false);
    if (result.success) {
      onDeleted();
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 px-4">
      <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle size={20} />
            <h2 className="font-display text-lg text-navy-950">Delete Account Permanently</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="tap-target text-navy-700/50 hover:text-navy-950"
            aria-label="Cancel"
          >
            <X size={18} />
          </button>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-navy-700/80">
          This permanently deletes <strong>{member.email}</strong>&rsquo;s login
          {member.eventLabel ? (
            <>
              {" "}
              and their entire event, <strong>{member.eventLabel}</strong> — every photo, video,
              audio message, guestbook note, invitee, and RSVP in it.
            </>
          ) : (
            "."
          )}{" "}
          This cannot be undone.
        </p>

        <label className="mt-4 block text-xs font-medium uppercase tracking-[0.15em] text-navy-700/70">
          Type <span className="font-mono normal-case text-red-600">{member.email}</span> to confirm
        </label>
        <input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          className={`${inputClasses} mt-1.5`}
          placeholder={member.email}
          autoFocus
        />

        {error ? (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <button
            type="button"
            disabled={!matches || deleting}
            onClick={handleDelete}
            className="inline-flex items-center gap-2 rounded-full bg-red-600 px-6 py-2 text-sm font-medium text-white transition-luxury duration-300 hover:bg-red-700 disabled:pointer-events-none disabled:opacity-50"
          >
            {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
            Delete Permanently
          </button>
        </div>
      </div>
    </div>
  );
}

function AddMemberForm({
  events,
  onClose,
  onAdded,
}: {
  events: EventOption[];
  onClose: () => void;
  onAdded: (member: AdminUserSummary) => void;
}) {
  const [method, setMethod] = useState<"invite" | "password">("invite");
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!eventId) {
      setError("Please choose an event.");
      return;
    }
    setSubmitting(true);

    const result =
      method === "invite"
        ? await addMemberByInviteAction(eventId, name, email)
        : await addMemberWithPasswordAction(eventId, name, email, password);

    setSubmitting(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    // The server actions don't return the new admins row (they only
    // revalidate the page) — good enough optimistic placeholder for an
    // immediately-responsive list; a page refresh shows the real id/
    // createdAt either way, same pattern as features/admin/team's
    // AddMemberForm.
    onAdded({
      id: `pending-${Date.now()}`,
      name: name.trim(),
      email: email.trim(),
      role: "client",
      eventLabel: events.find((e) => e.id === eventId)?.label ?? null,
      resolvedEventId: eventId,
      createdAt: new Date().toISOString(),
    });
  }

  return (
    <div className="mt-4 rounded-xl border border-gold-500/20 bg-gold-500/5 p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base text-navy-950">Add Member</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cancel"
          className="tap-target text-navy-700/50 hover:text-navy-950"
        >
          <X size={16} />
        </button>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => setMethod("invite")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-luxury duration-200",
            method === "invite"
              ? "border-gold-500 bg-gold-500/10 text-navy-950"
              : "border-navy-950/15 text-navy-700/60",
          )}
        >
          <Mail size={13} /> Send Invite Email
        </button>
        <button
          type="button"
          onClick={() => setMethod("password")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-luxury duration-200",
            method === "password"
              ? "border-gold-500 bg-gold-500/10 text-navy-950"
              : "border-navy-950/15 text-navy-700/60",
          )}
        >
          <KeyRound size={13} /> Set Password Myself
        </button>
      </div>

      <p className="mt-3 text-xs text-navy-700/60">
        {method === "invite"
          ? "They'll get an email with a link to set their own password."
          : "You choose the password now and share it with them yourself — their account is ready immediately."}
        {" "}Every new login here gets the &ldquo;Client&rdquo; role, scoped to whichever event you pick below —
        the same as inviting a teammate from that event&rsquo;s own Team page. Each event allows up to 4 logins.
      </p>

      <form onSubmit={onSubmit} className="mt-4 grid gap-3">
        <div>
          <label className={labelClasses} htmlFor="add-member-event">
            Event
          </label>
          <select
            id="add-member-event"
            required
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className={`${addFormInputClasses} mt-1.5`}
          >
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClasses} htmlFor="add-member-name">
            Name
          </label>
          <input
            id="add-member-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`${addFormInputClasses} mt-1.5`}
          />
        </div>
        <div>
          <label className={labelClasses} htmlFor="add-member-email">
            Email
          </label>
          <input
            id="add-member-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`${addFormInputClasses} mt-1.5`}
          />
        </div>
        {method === "password" ? (
          <div>
            <label className={labelClasses} htmlFor="add-member-password">
              Password
            </label>
            <input
              id="add-member-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${addFormInputClasses} mt-1.5`}
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
          {submitting ? (
            <Loader2 className="animate-spin" size={16} />
          ) : method === "invite" ? (
            "Send Invite"
          ) : (
            "Add Member"
          )}
        </button>
      </form>
    </div>
  );
}

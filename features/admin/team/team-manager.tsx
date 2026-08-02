"use client";

import { useState, useTransition } from "react";
import { Loader2, Mail, KeyRound, UserMinus, UserPlus, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { TeamMember } from "@/services/admin-team";
import {
  addTeamMemberWithPasswordAction,
  inviteTeamMemberAction,
  removeTeamMemberAction,
} from "@/features/admin/team/actions";

const TEAM_MEMBER_CAP = 4;

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";
const labelClasses = "text-xs font-medium uppercase tracking-[0.15em] text-navy-700/70";

interface TeamManagerProps {
  eventId: string;
  currentAdminId: string;
  initialMembers: TeamMember[];
}

/**
 * Lets a client (or the owner, viewing this event) manage everyone
 * with dashboard access to ONE event — up to TEAM_MEMBER_CAP total.
 * Two ways to add someone (features/admin/team/actions.ts's two
 * actions): an emailed invite the family member completes themselves,
 * or a password the inviting client sets directly and shares out of
 * band. Both land the new person as a full-access "client" admin —
 * there's no lighter/view-only role today.
 */
export function TeamManager({ eventId, currentAdminId, initialMembers }: TeamManagerProps) {
  const [members, setMembers] = useState(initialMembers);
  const [showAddForm, setShowAddForm] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const atCap = members.length >= TEAM_MEMBER_CAP;

  function handleRemove(member: TeamMember) {
    if (!confirm(`Remove dashboard access for ${member.name || member.email}? They'll be signed out immediately.`)) {
      return;
    }
    setListError(null);
    setBusyId(member.id);
    startTransition(async () => {
      const result = await removeTeamMemberAction(eventId, member.id);
      setBusyId(null);
      if (result.success) {
        setMembers((prev) => prev.filter((m) => m.id !== member.id));
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
              <th className="px-4 py-3">Member</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-950/5">
            {members.map((member) => (
              <tr key={member.id}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 font-medium text-navy-950">
                    {member.name || "—"}
                    {member.id === currentAdminId ? (
                      <span className="rounded-full bg-gold-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold-700">
                        You
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-navy-700/50">{member.email}</div>
                </td>
                <td className="px-4 py-3 text-navy-700/70">
                  {new Date(member.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </td>
                <td className="px-4 py-3 text-right">
                  {member.id !== currentAdminId ? (
                    <button
                      type="button"
                      disabled={busyId === member.id}
                      onClick={() => handleRemove(member)}
                      className="inline-flex items-center gap-1 text-xs text-navy-700/60 hover:text-red-600 disabled:opacity-50"
                    >
                      {busyId === member.id ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <UserMinus size={13} />
                      )}
                      Remove
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {listError ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {listError}
        </p>
      ) : null}

      <p className="mt-3 text-xs text-navy-700/50">
        {members.length} of {TEAM_MEMBER_CAP} team members
      </p>

      {showAddForm ? (
        <AddMemberForm
          eventId={eventId}
          onClose={() => setShowAddForm(false)}
          onAdded={(member) => {
            setMembers((prev) => [...prev, member]);
            setShowAddForm(false);
          }}
        />
      ) : (
        <button
          type="button"
          disabled={atCap}
          onClick={() => setShowAddForm(true)}
          className="tap-target mt-4 flex items-center gap-2 rounded-full border border-gold-500/40 px-4 py-2 text-sm font-medium text-gold-700 transition-luxury duration-200 hover:border-gold-500 hover:bg-gold-500/5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <UserPlus size={16} />
          {atCap ? "Team is full" : "Add a Team Member"}
        </button>
      )}
    </div>
  );
}

function AddMemberForm({
  eventId,
  onClose,
  onAdded,
}: {
  eventId: string;
  onClose: () => void;
  onAdded: (member: TeamMember) => void;
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
        ? await inviteTeamMemberAction(eventId, name, email)
        : await addTeamMemberWithPasswordAction(eventId, name, email, password);

    setSubmitting(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    // The server actions don't return the new row's id/createdAt (they
    // only revalidate the page), so this is an optimistic placeholder —
    // good enough for the list to feel immediately responsive, and a
    // page refresh will show the real created_at either way.
    onAdded({
      id: `pending-${Date.now()}`,
      name: name.trim(),
      email: email.trim(),
      role: "client",
      createdAt: new Date().toISOString(),
    });
  }

  return (
    <div className="mt-4 rounded-xl border border-gold-500/20 bg-gold-500/5 p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base text-navy-950">Add a Team Member</h3>
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
      </p>

      <form onSubmit={onSubmit} className="mt-4 grid gap-3">
        <div>
          <label className={labelClasses} htmlFor="member-name">
            Name
          </label>
          <input
            id="member-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`${inputClasses} mt-1.5`}
          />
        </div>
        <div>
          <label className={labelClasses} htmlFor="member-email">
            Email
          </label>
          <input
            id="member-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`${inputClasses} mt-1.5`}
          />
        </div>
        {method === "password" ? (
          <div>
            <label className={labelClasses} htmlFor="member-password">
              Password
            </label>
            <input
              id="member-password"
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

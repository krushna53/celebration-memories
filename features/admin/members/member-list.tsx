"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Crown, Loader2, Trash2, UserMinus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { removeAdminAccessAction, deleteAdminAccountAction } from "@/features/admin/members/actions";
import type { AdminUserSummary } from "@/services/admin-users";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-400/30";

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
 * Owner accounts get neither.
 */
export function MemberList({ initialMembers }: { initialMembers: AdminUserSummary[] }) {
  const [members, setMembers] = useState(initialMembers);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUserSummary | null>(null);
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
        <table className="w-full text-left text-sm">
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
                <td className="px-4 py-3">
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
                <td className="px-4 py-3 text-navy-700/70">{member.eventLabel ?? "—"}</td>
                <td className="px-4 py-3 text-navy-700/70">
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

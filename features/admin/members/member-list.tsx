"use client";

import { useState, useTransition } from "react";
import { Crown, Loader2, UserMinus } from "lucide-react";

import { removeAdminAccessAction } from "@/features/admin/members/actions";
import type { AdminUserSummary } from "@/services/admin-users";

/**
 * Owner-only list of every dashboard-login account (app/admin/(dashboard)
 * /members) — distinct from Invitees, which is event guests with no
 * login at all. Only client-role rows get a "Remove Access" button;
 * owner accounts can't be removed from this screen (see
 * services/admin-users.ts's deleteAdminAccess).
 */
export function MemberList({ initialMembers }: { initialMembers: AdminUserSummary[] }) {
  const [members, setMembers] = useState(initialMembers);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
                    <button
                      type="button"
                      disabled={busyId === member.id}
                      onClick={() => remove(member.id, member.name || member.email)}
                      className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
                    >
                      {busyId === member.id ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <UserMinus size={13} />
                      )}
                      Remove Access
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

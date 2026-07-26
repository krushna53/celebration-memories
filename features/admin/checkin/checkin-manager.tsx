"use client";

import { useMemo, useState } from "react";
import { Search, UserCheck, UserX } from "lucide-react";

import { cn } from "@/lib/utils";
import { toggleCheckInAction } from "@/features/admin/invitees/actions";
import type { InviteeRecord } from "@/types/event";

interface CheckinManagerProps {
  initialInvitees: InviteeRecord[];
}

export function CheckinManager({ initialInvitees }: CheckinManagerProps) {
  const [invitees, setInvitees] = useState(initialInvitees);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const checkedInCount = invitees.filter((i) => i.checkedIn).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return invitees;
    return invitees.filter((inv) => inv.name.toLowerCase().includes(q));
  }, [invitees, search]);

  async function toggle(id: string, next: boolean) {
    setBusyId(id);
    const result = await toggleCheckInAction(id, next);
    if (result.success) {
      setInvitees((prev) =>
        prev.map((inv) => (inv.id === id ? { ...inv, checkedIn: next } : inv)),
      );
    }
    setBusyId(null);
  }

  return (
    <div>
      <div className="rounded-xl border border-gold-500/20 bg-gold-500/5 px-5 py-4 text-center">
        <p className="font-display text-3xl text-navy-950">
          {checkedInCount} <span className="text-lg text-navy-700/50">/ {invitees.length}</span>
        </p>
        <p className="text-xs uppercase tracking-[0.2em] text-navy-700/60">Checked In</p>
      </div>

      <div className="relative mt-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-700/40" size={16} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search guest name..."
          className="w-full rounded-lg border border-navy-950/15 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
        />
      </div>

      <div className="mt-4 divide-y divide-navy-950/5 rounded-xl border border-navy-950/10 bg-white">
        {filtered.map((inv) => (
          <div key={inv.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-navy-950">{inv.name}</p>
              <p className="text-xs text-navy-700/50">{inv.phone || inv.email || "—"}</p>
            </div>
            <button
              type="button"
              disabled={busyId === inv.id}
              onClick={() => toggle(inv.id, !inv.checkedIn)}
              className={cn(
                "tap-target flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium transition-luxury duration-200",
                inv.checkedIn
                  ? "bg-green-100 text-green-800"
                  : "border border-navy-950/15 text-navy-700/70",
              )}
            >
              {inv.checkedIn ? <UserCheck size={14} /> : <UserX size={14} />}
              {inv.checkedIn ? "Checked In" : "Check In"}
            </button>
          </div>
        ))}
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-navy-700/50">No guests found.</p>
        ) : null}
      </div>
    </div>
  );
}

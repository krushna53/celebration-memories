"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";

export interface LoginActivityDisplayRow {
  id: string;
  email: string;
  name: string | null;
  /** e.g. ["Admin · owner", "Business"] — empty means signed up but never finished onboarding. */
  badges: string[];
  /** Pre-formatted on the server in IST, e.g. "Wed, Oct 7, 2026 · 9:42 AM IST" — null = never signed in. */
  lastSignIn: string | null;
  /** e.g. "3 hours ago". */
  lastSignInRelative: string | null;
  /** Signed in within the last 7 days — gets a green dot. */
  recent: boolean;
  joined: string;
}

const FILTERS = [
  { value: "all", label: "All" },
  { value: "admin", label: "Admins" },
  { value: "business", label: "Business" },
  { value: "forms", label: "Forms" },
  { value: "never", label: "Never signed in" },
] as const;
type Filter = (typeof FILTERS)[number]["value"];

/** Searchable, filterable table for /admin/logins — rows arrive already sorted (most recent sign-in first). */
export function LoginActivityTable({ rows }: { rows: LoginActivityDisplayRow[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter === "never" && row.lastSignIn) return false;
      if (filter === "admin" && !row.badges.some((b) => b.startsWith("Admin"))) return false;
      if (filter === "business" && !row.badges.includes("Business")) return false;
      if (filter === "forms" && !row.badges.includes("Forms")) return false;
      if (!q) return true;
      return row.email.toLowerCase().includes(q) || (row.name ?? "").toLowerCase().includes(q);
    });
  }, [rows, query, filter]);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block w-full sm:max-w-xs">
          <span className="sr-only">Search by name or email</span>
          <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy-700/40" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or email"
            className="w-full rounded-lg border border-navy-950/15 bg-white py-2.5 pl-9 pr-3 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
          />
        </label>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter accounts">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs transition-luxury duration-300",
                filter === f.value
                  ? "border-navy-950 bg-navy-950 text-ivory-50"
                  : "border-navy-950/15 text-navy-700/80 hover:border-gold-400",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-4 text-xs text-navy-700/60">
        Showing {visible.length} of {rows.length}
      </p>

      <div className="mt-2 overflow-x-auto rounded-xl border border-navy-950/10 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-navy-950/10 bg-ivory-50 text-xs uppercase tracking-[0.12em] text-navy-700/60">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Account</th>
              <th scope="col" className="px-4 py-3 font-medium">Type</th>
              <th scope="col" className="px-4 py-3 font-medium">Last login</th>
              <th scope="col" className="px-4 py-3 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-950/5">
            {visible.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-navy-950">{row.name ?? "—"}</p>
                  <p className="text-xs text-navy-700/60">{row.email}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {row.badges.length > 0 ? (
                      row.badges.map((badge) => (
                        <span key={badge} className="rounded-full bg-navy-950/5 px-2 py-0.5 text-xs text-navy-700">
                          {badge}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-navy-700/40">No profile</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {row.lastSignIn ? (
                    <div className="flex items-start gap-2">
                      <span
                        aria-hidden="true"
                        className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", row.recent ? "bg-emerald-500" : "bg-navy-950/20")}
                      />
                      <div>
                        <p className="text-navy-950">{row.lastSignInRelative}</p>
                        <p className="text-xs text-navy-700/60">{row.lastSignIn}</p>
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-navy-700/50">Never signed in</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-navy-700/70">{row.joined}</td>
              </tr>
            ))}
            {visible.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-navy-700/50">
                  No accounts match.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

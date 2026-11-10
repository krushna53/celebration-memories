"use client";

import { useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { exportRsvpCsvAction } from "@/features/admin/invitees/actions";
import type { InviteeWithRsvp } from "@/services/admin-invitees";
import type { RsvpStatus } from "@/types/event";

const RSVP_LABEL: Record<RsvpStatus, string> = {
  pending: "Pending",
  coming: "Coming",
  maybe: "Maybe",
  not_coming: "Declined",
};

const RSVP_COLOR: Record<RsvpStatus, string> = {
  pending: "bg-navy-950/10 text-navy-700",
  coming: "bg-green-100 text-green-800",
  maybe: "bg-amber-100 text-amber-800",
  not_coming: "bg-red-100 text-red-700",
};

const FILTERS: readonly ("all" | RsvpStatus)[] = ["all", "coming", "maybe", "not_coming", "pending"];

interface RsvpListProps {
  eventId: string;
  eventSlug: string;
  invitees: InviteeWithRsvp[];
}

/**
 * Read-only guest list with each RSVP — the /admin/rsvps page. Nothing
 * here edits a guest; that stays on /admin/invitees. Export uses the same
 * CSV action as Invitees (gated by requireAdminForReviewerArea).
 */
export function RsvpList({ eventId, eventSlug, invitees }: RsvpListProps) {
  const [filter, setFilter] = useState<"all" | RsvpStatus>("all");
  const [query, setQuery] = useState("");
  const [exporting, setExporting] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return invitees.filter(
      (invitee) =>
        (filter === "all" || invitee.rsvpStatus === filter) &&
        (!q || invitee.name.toLowerCase().includes(q) || (invitee.phone ?? "").includes(q)),
    );
  }, [invitees, filter, query]);

  async function handleExport() {
    setExporting(true);
    const result = await exportRsvpCsvAction(eventId, eventSlug);
    setExporting(false);
    if (!result.success) {
      alert(result.error);
      return;
    }
    const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = result.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            aria-pressed={filter === value}
            className={`rounded-full px-3 py-1.5 text-sm ${filter === value ? "bg-gold-500 text-navy-950" : "border border-navy-950/15 text-navy-700/70"}`}
          >
            {value === "all" ? "All" : RSVP_LABEL[value]}
          </button>
        ))}
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or phone"
          aria-label="Search guests"
          className="min-w-0 flex-1 rounded-lg border border-navy-950/15 bg-white px-3 py-2 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30 sm:max-w-xs"
        />
        <Button variant="outline" onClick={handleExport} disabled={exporting || invitees.length === 0}>
          {exporting ? <Loader2 className="animate-spin" size={15} /> : <Download size={15} />} Export CSV
        </Button>
      </div>

      {visible.length === 0 ? (
        <p className="mt-6 text-sm text-navy-700/50">No guests match.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-navy-950/10 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-navy-950/10 text-xs uppercase tracking-[0.15em] text-navy-700/60">
              <tr>
                <th className="px-4 py-3 font-medium">Guest</th>
                <th className="px-4 py-3 font-medium">RSVP</th>
                <th className="px-4 py-3 font-medium">Adults</th>
                <th className="px-4 py-3 font-medium">Children</th>
                <th className="px-4 py-3 font-medium">Meal</th>
                <th className="px-4 py-3 font-medium">Comments</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-950/5">
              {visible.map((invitee) => (
                <tr key={invitee.id}>
                  <td className="px-4 py-3">
                    <p className="text-navy-950">{invitee.name}</p>
                    {invitee.phone ? <p className="text-xs text-navy-700/50">{invitee.phone}</p> : null}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${RSVP_COLOR[invitee.rsvpStatus]}`}>
                      {RSVP_LABEL[invitee.rsvpStatus]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-navy-700">{invitee.rsvpDetail?.adults ?? "—"}</td>
                  <td className="px-4 py-3 text-navy-700">{invitee.rsvpDetail?.children ?? "—"}</td>
                  <td className="px-4 py-3 text-navy-700">{invitee.rsvpDetail?.mealPreference || "—"}</td>
                  <td className="max-w-xs px-4 py-3 text-navy-700">{invitee.rsvpDetail?.comments || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

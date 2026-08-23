"use client";

import { useState } from "react";
import { MessageCircle, ExternalLink } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ConciergeInquiry } from "@/services/concierge";
import { updateConciergeStatusAction } from "@/features/concierge/actions";

const STATUS_STYLES: Record<ConciergeInquiry["status"], string> = {
  new:        "bg-amber-100 text-amber-800",
  contacted:  "bg-blue-100 text-blue-800",
  closed:     "bg-green-100 text-green-800",
};

const WA_MESSAGE = encodeURIComponent(
  "Hey! We recently got your inquiry from everymoment.in. How can we help you? 😊",
);

function waLink(countryCode: string, phone: string) {
  const digits = (countryCode.replace(/\D/g, "") + phone.replace(/\D/g, ""));
  return `https://wa.me/${digits}?text=${WA_MESSAGE}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface Props {
  inquiries: ConciergeInquiry[];
}

export function ConciergeInquiriesTable({ inquiries: initial }: Props) {
  const [rows, setRows] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleStatusChange(id: string, status: ConciergeInquiry["status"]) {
    setBusyId(id);
    await updateConciergeStatusAction(id, status);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    setBusyId(null);
  }

  if (rows.length === 0) {
    return (
      <p className="mt-6 rounded-xl border border-dashed border-navy-950/15 py-20 text-center text-sm text-navy-700/50">
        No concierge inquiries yet — they'll appear here as visitors submit their numbers.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-navy-950/10 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-navy-950/10 bg-ivory-50 text-left text-[11px] font-semibold uppercase tracking-widest text-navy-700/50">
            <th className="px-4 py-3">Phone</th>
            <th className="px-4 py-3">Page</th>
            <th className="px-4 py-3">Received</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-navy-950/5">
          {rows.map((row) => (
            <tr key={row.id} className={cn("transition-colors", busyId === row.id && "opacity-50")}>
              {/* Phone */}
              <td className="px-4 py-3 font-medium text-navy-950">
                {row.country_code} {row.phone}
              </td>

              {/* Page URL */}
              <td className="max-w-[220px] px-4 py-3">
                {row.page_url ? (
                  <a
                    href={`https://everymoment.in${row.page_url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 truncate text-xs text-navy-700/60 hover:text-gold-600"
                    title={row.page_url}
                  >
                    <span className="truncate">{row.page_url}</span>
                    <ExternalLink size={10} className="shrink-0" />
                  </a>
                ) : (
                  <span className="text-xs text-navy-700/30">—</span>
                )}
              </td>

              {/* Date */}
              <td className="whitespace-nowrap px-4 py-3 text-xs text-navy-700/60">
                {formatDate(row.created_at)}
              </td>

              {/* Status */}
              <td className="px-4 py-3">
                <select
                  value={row.status}
                  disabled={busyId === row.id}
                  onChange={(e) =>
                    handleStatusChange(row.id, e.target.value as ConciergeInquiry["status"])
                  }
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize focus:outline-none",
                    STATUS_STYLES[row.status],
                  )}
                >
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="closed">Closed</option>
                </select>
              </td>

              {/* WhatsApp */}
              <td className="px-4 py-3 text-right">
                <a
                  href={waLink(row.country_code, row.phone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`WhatsApp ${row.country_code} ${row.phone}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-green-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-green-600"
                >
                  <MessageCircle size={13} />
                  WhatsApp
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="border-t border-navy-950/5 px-4 py-2 text-xs text-navy-700/40">
        {rows.length} {rows.length === 1 ? "inquiry" : "inquiries"} total
        {" · "}
        {rows.filter((r) => r.status === "new").length} new
      </div>
    </div>
  );
}

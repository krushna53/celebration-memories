"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { approveRsvpPaymentAction, rejectRsvpPaymentAction } from "@/features/admin/rsvp-payments/actions";
import type { RsvpPaymentQueueItem } from "@/services/rsvp-payments";
import type { RsvpPaymentStatus } from "@/types/rsvp-payment";

const STATUS_STYLES: Record<RsvpPaymentStatus, { label: string; className: string; icon: typeof Clock }> = {
  pending: { label: "Pending", className: "bg-gold-500/15 text-gold-700", icon: Clock },
  paid: { label: "Paid", className: "bg-emerald-500/15 text-emerald-700", icon: CheckCircle2 },
  failed: { label: "Failed", className: "bg-red-500/15 text-red-700", icon: XCircle },
  rejected: { label: "Rejected", className: "bg-red-500/15 text-red-700", icon: AlertCircle },
};

const PROVIDER_LABEL: Record<string, string> = {
  manual: "Bank / UPI",
  stripe: "Stripe",
  razorpay: "Razorpay",
  ccavenue: "CCAvenue",
};

/** Admin-facing list of RSVP payments for one event (/admin/rsvp-payments) — manual (bank/UPI) rows are the only ones with Approve/Reject buttons, since Stripe/Razorpay/CCAvenue rows are already gateway-verified by the time they land here. */
export function RsvpPaymentList({ initialItems }: { initialItems: RsvpPaymentQueueItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleApprove(id: string) {
    setBusyId(id);
    const result = await approveRsvpPaymentAction(id);
    setBusyId(null);
    if (result.success) {
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status: "paid" as const } : item)));
    } else {
      setErrors((prev) => ({ ...prev, [id]: result.error }));
    }
  }

  async function handleReject(id: string) {
    setBusyId(id);
    const result = await rejectRsvpPaymentAction(id, noteDrafts[id] ?? "");
    setBusyId(null);
    if (result.success) {
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status: "rejected" as const } : item)));
    } else {
      setErrors((prev) => ({ ...prev, [id]: result.error }));
    }
  }

  if (items.length === 0) {
    return <p className="text-sm text-navy-700/60">No RSVP payments yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-navy-950/10 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-navy-950/10 text-xs uppercase tracking-wide text-navy-700/50">
          <tr>
            <th className="px-4 py-3">Guest</th>
            <th className="px-4 py-3">Amount</th>
            <th className="px-4 py-3">Method</th>
            <th className="px-4 py-3">Reference</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const status = STATUS_STYLES[item.status];
            const StatusIcon = status.icon;
            return (
              <tr key={item.id} className="border-b border-navy-950/5 last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium text-navy-950">{item.inviteeName}</div>
                  <div className="text-xs text-navy-700/50">{item.inviteePhone || item.inviteeEmail || ""}</div>
                </td>
                <td className="px-4 py-3 text-navy-950">
                  {item.currency} {item.amount}
                  <span className="ml-1 text-xs text-navy-700/50">({item.pricingTier === "early_bird" ? "early-bird" : "regular"})</span>
                </td>
                <td className="px-4 py-3 text-navy-700/70">{PROVIDER_LABEL[item.provider] ?? item.provider}</td>
                <td className="px-4 py-3 text-navy-700/70">{item.referenceNote || item.externalId || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}>
                    <StatusIcon size={12} /> {status.label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {item.provider === "manual" && item.status === "pending" ? (
                    <div className="flex flex-col gap-2">
                      <input
                        value={noteDrafts[item.id] ?? ""}
                        onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        placeholder="Note if rejecting"
                        className="w-40 rounded-lg border border-navy-950/15 bg-white px-2 py-1.5 text-xs text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" disabled={busyId === item.id} onClick={() => handleApprove(item.id)}>
                          {busyId === item.id ? <Loader2 className="animate-spin" size={12} /> : "Approve"}
                        </Button>
                        <Button size="sm" variant="outline" disabled={busyId === item.id} onClick={() => handleReject(item.id)}>
                          Reject
                        </Button>
                      </div>
                      {errors[item.id] ? (
                        <p className="text-xs text-red-600" role="alert">
                          {errors[item.id]}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

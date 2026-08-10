"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Clock, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { approveEventPaymentSettingsAction, rejectEventPaymentSettingsAction } from "@/features/admin/payment-settings-review/actions";
import type { EventPaymentSettingsQueueItem } from "@/services/event-payment-settings";
import type { EventPaymentSettingsRecord } from "@/types/event-payment-settings";

const STATUS_STYLES: Record<EventPaymentSettingsRecord["status"], { label: string; className: string; icon: typeof Clock }> = {
  pending_review: { label: "Pending review", className: "bg-gold-500/15 text-gold-700", icon: Clock },
  approved: { label: "Approved", className: "bg-emerald-500/15 text-emerald-700", icon: CheckCircle2 },
  rejected: { label: "Rejected", className: "bg-red-500/15 text-red-700", icon: AlertCircle },
};

const PROVIDER_LABEL: Record<string, string> = {
  manual: "Bank / UPI",
  stripe: "Stripe",
  razorpay: "Razorpay",
  ccavenue: "CCAvenue",
};

/**
 * Owner-only review queue for client-submitted event payment settings
 * (/admin/payment-settings-review) — same card + status-pill +
 * approve/reject-button shape as features/admin/template-submissions/
 * template-submission-list.tsx, the established client-submits/
 * owner-approves pattern in this codebase.
 */
export function PaymentSettingsReviewList({ initialItems }: { initialItems: EventPaymentSettingsQueueItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleApprove(id: string) {
    setBusyId(id);
    setErrors((prev) => ({ ...prev, [id]: "" }));
    const result = await approveEventPaymentSettingsAction(id);
    setBusyId(null);
    if (result.success) {
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status: "approved" as const } : item)));
    } else {
      setErrors((prev) => ({ ...prev, [id]: result.error }));
    }
  }

  async function handleReject(id: string) {
    setBusyId(id);
    setErrors((prev) => ({ ...prev, [id]: "" }));
    const result = await rejectEventPaymentSettingsAction(id, noteDrafts[id] ?? "");
    setBusyId(null);
    if (result.success) {
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status: "rejected" as const } : item)));
    } else {
      setErrors((prev) => ({ ...prev, [id]: result.error }));
    }
  }

  if (items.length === 0) {
    return <p className="text-sm text-navy-700/60">No payment settings submissions yet.</p>;
  }

  return (
    <div className="grid gap-4">
      {items.map((item) => {
        const status = STATUS_STYLES[item.status];
        const StatusIcon = status.icon;
        return (
          <div key={item.id} className="rounded-xl border border-navy-950/10 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-base text-navy-950">
                  {item.eventHonoreeName} — {item.eventTitle}
                </h3>
                <p className="mt-0.5 text-xs text-navy-700/50">/events/{item.eventSlug}</p>
              </div>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${status.className}`}>
                <StatusIcon size={12} /> {status.label}
              </span>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs uppercase tracking-wide text-navy-700/50">Method</dt>
                <dd className="text-navy-950">{PROVIDER_LABEL[item.provider] ?? item.provider}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-navy-700/50">Currency</dt>
                <dd className="text-navy-950">{item.currency}</dd>
              </div>
              {item.provider === "manual" ? (
                <div className="col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-navy-700/50">UPI</dt>
                  <dd className="text-navy-950">{item.upiId || "—"}</dd>
                </div>
              ) : null}
              {item.provider === "stripe" ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-navy-700/50">Secret Key</dt>
                  <dd className="text-navy-950">{item.stripeSecretKey || "—"}</dd>
                </div>
              ) : null}
              {item.provider === "razorpay" ? (
                <>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-navy-700/50">Key ID</dt>
                    <dd className="text-navy-950">{item.razorpayKeyId || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-navy-700/50">Key Secret</dt>
                    <dd className="text-navy-950">{item.razorpayKeySecret || "—"}</dd>
                  </div>
                </>
              ) : null}
              {item.provider === "ccavenue" ? (
                <>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-navy-700/50">Merchant ID</dt>
                    <dd className="text-navy-950">{item.ccavenueMerchantId || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-navy-700/50">Working Key</dt>
                    <dd className="text-navy-950">{item.ccavenueWorkingKey || "—"}</dd>
                  </div>
                </>
              ) : null}
            </dl>

            {item.status === "pending_review" ? (
              <div className="mt-4 border-t border-navy-950/10 pt-4">
                <input
                  value={noteDrafts[item.id] ?? ""}
                  onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  placeholder="Note if rejecting (optional)"
                  className="w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                />
                <div className="mt-3 flex gap-2">
                  <Button size="sm" disabled={busyId === item.id} onClick={() => handleApprove(item.id)}>
                    {busyId === item.id ? <Loader2 className="animate-spin" size={14} /> : "Approve"}
                  </Button>
                  <Button size="sm" variant="outline" disabled={busyId === item.id} onClick={() => handleReject(item.id)}>
                    Reject
                  </Button>
                </div>
                {errors[item.id] ? (
                  <p className="mt-2 text-sm text-red-600" role="alert">{errors[item.id]}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

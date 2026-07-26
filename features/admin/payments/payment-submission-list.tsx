"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  confirmPaymentSubmissionAction,
  rejectPaymentSubmissionAction,
} from "@/features/admin/payments/actions";
import type { PaymentSubmissionRecord } from "@/types/payment";

interface PaymentSubmissionListProps {
  initialSubmissions: PaymentSubmissionRecord[];
}

const STATUS_STYLES: Record<PaymentSubmissionRecord["status"], string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  confirmed: "border-green-200 bg-green-50 text-green-700",
  rejected: "border-navy-950/10 bg-navy-950/[0.03] text-navy-700/50",
};

export function PaymentSubmissionList({ initialSubmissions }: PaymentSubmissionListProps) {
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  async function handleConfirm(id: string) {
    setBusyId(id);
    const result = await confirmPaymentSubmissionAction(id);
    if (result.success) {
      setSubmissions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: "confirmed" as const } : s)),
      );
    }
    setBusyId(null);
  }

  async function handleReject(id: string) {
    setBusyId(id);
    const note = noteDrafts[id] ?? "";
    const result = await rejectPaymentSubmissionAction(id, note);
    if (result.success) {
      setSubmissions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: "rejected" as const, adminNote: note || null } : s)),
      );
    }
    setBusyId(null);
  }

  if (submissions.length === 0) {
    return (
      <p className="mt-6 rounded-xl border border-dashed border-navy-950/15 py-16 text-center text-sm text-navy-700/50">
        No payment submissions yet.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {submissions.map((submission) => (
        <div
          key={submission.id}
          className="flex flex-col gap-2 rounded-xl border border-navy-950/10 bg-white p-4 shadow-sm"
        >
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                STATUS_STYLES[submission.status],
              )}
            >
              {submission.status}
            </span>
            <span className="text-xs text-navy-700/40">
              {new Date(submission.createdAt).toLocaleString()}
            </span>
          </div>

          <p className="font-display text-lg text-navy-950">
            &#8377;{submission.amount.toLocaleString("en-IN")}
          </p>

          <div className="grid gap-0.5 text-sm text-navy-700/80">
            <p className="font-medium text-navy-950">{submission.payerName}</p>
            {submission.payerEmail ? <p className="text-xs text-navy-700/60">{submission.payerEmail}</p> : null}
            {submission.payerPhone ? <p className="text-xs text-navy-700/60">{submission.payerPhone}</p> : null}
          </div>

          {submission.purpose ? (
            <p className="text-xs text-navy-700/60">
              <span className="font-medium text-navy-700/80">Purpose:</span> {submission.purpose}
            </p>
          ) : null}
          {submission.referenceNote ? (
            <p className="text-xs text-navy-700/60">
              <span className="font-medium text-navy-700/80">Reference:</span> {submission.referenceNote}
            </p>
          ) : null}
          {submission.adminNote ? (
            <p className="text-xs italic text-navy-700/50">Note: {submission.adminNote}</p>
          ) : null}

          {submission.status === "pending" ? (
            <div className="mt-1 border-t border-navy-950/5 pt-3">
              <input
                placeholder="Optional note if rejecting..."
                value={noteDrafts[submission.id] ?? ""}
                onChange={(e) =>
                  setNoteDrafts((prev) => ({ ...prev, [submission.id]: e.target.value }))
                }
                className="w-full rounded-lg border border-navy-950/15 px-2.5 py-1.5 text-xs focus:border-gold-500 focus:outline-none"
              />
              <div className="mt-2 flex gap-2">
                <button
                  disabled={busyId === submission.id}
                  onClick={() => handleConfirm(submission.id)}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  <Check size={14} /> Confirm
                </button>
                <button
                  disabled={busyId === submission.id}
                  onClick={() => handleReject(submission.id)}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-navy-950/15 px-3 py-1.5 text-xs font-medium text-navy-700 hover:bg-navy-950/5 disabled:opacity-50"
                >
                  <X size={14} /> Reject
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

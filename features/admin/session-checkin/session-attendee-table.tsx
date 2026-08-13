"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Circle, Download, Loader2, Undo2 } from "lucide-react";

import { checkInByCodeAction, checkInByRegistrationIdAction, undoCheckInAction } from "@/features/admin/session-checkin/actions";
import { QrScanner } from "@/features/admin/session-checkin/qr-scanner";
import type { SessionAttendee } from "@/services/session-registrations";
import type { RsvpPaymentQueueItem } from "@/services/rsvp-payments";
import type { CustomFormField, CustomFormResponse } from "@/services/custom-forms";

const PAYMENT_LABEL: Record<string, string> = { pending: "Pending", paid: "Paid", failed: "Failed", rejected: "Rejected" };
const PAYMENT_CLASS: Record<string, string> = {
  pending: "bg-gold-500/15 text-gold-700",
  paid: "bg-emerald-500/15 text-emerald-700",
  failed: "bg-red-500/15 text-red-700",
  rejected: "bg-red-500/15 text-red-700",
};

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/**
 * Per-session attendee table (#106 Phase 4-5) — combines registration,
 * payment status, QR/manual check-in, and any linked Custom Form
 * Builder answers into one view. Used by both the host (any session in
 * their event) and a session_organizer (their own assigned session
 * only) — the caller decides which sessions to render this for; this
 * component itself just needs a scheduleItemId + eventId it's already
 * been authorized to see.
 */
export function SessionAttendeeTable({
  scheduleItemId,
  sessionTitle,
  isPaidSession,
  initialAttendees,
  initialPayments,
  customFormFields = [],
  responsesByRegistrationId = {},
}: {
  scheduleItemId: string;
  sessionTitle: string;
  isPaidSession: boolean;
  initialAttendees: SessionAttendee[];
  initialPayments: RsvpPaymentQueueItem[];
  customFormFields?: CustomFormField[];
  responsesByRegistrationId?: Record<string, CustomFormResponse>;
}) {
  const [attendees, setAttendees] = useState(initialAttendees);
  const [manualCode, setManualCode] = useState("");
  const [checkinBusy, setCheckinBusy] = useState<string | null>(null);
  const [checkinMessage, setCheckinMessage] = useState<{ text: string; tone: "success" | "error" } | null>(null);

  const latestPaymentByInvitee = useMemo(() => {
    const map = new Map<string, RsvpPaymentQueueItem>();
    for (const payment of initialPayments) {
      const existing = map.get(payment.inviteeId);
      if (!existing || new Date(payment.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
        map.set(payment.inviteeId, payment);
      }
    }
    return map;
  }, [initialPayments]);

  function applyCheckIn(registrationId: string, attendedAt: string | null) {
    setAttendees((prev) => prev.map((a) => (a.id === registrationId ? { ...a, attendedAt } : a)));
  }

  async function handleCheckInByCode(code: string) {
    setCheckinBusy("code");
    const result = await checkInByCodeAction(scheduleItemId, code);
    setCheckinBusy(null);
    if (result.success) {
      setCheckinMessage({ text: result.alreadyCheckedIn ? `${result.guestName} was already checked in.` : `${result.guestName} checked in!`, tone: "success" });
      applyCheckIn(result.registrationId, result.attendedAt);
      setManualCode("");
    } else {
      setCheckinMessage({ text: result.error, tone: "error" });
    }
    setTimeout(() => setCheckinMessage(null), 4000);
  }

  async function handleMarkAttended(registrationId: string) {
    setCheckinBusy(registrationId);
    const result = await checkInByRegistrationIdAction(scheduleItemId, registrationId);
    setCheckinBusy(null);
    if (result.success) {
      applyCheckIn(result.registrationId, result.attendedAt);
    } else {
      alert(result.error);
    }
  }

  async function handleUndo(registrationId: string) {
    setCheckinBusy(registrationId);
    const result = await undoCheckInAction(scheduleItemId, registrationId);
    setCheckinBusy(null);
    if (result.success) {
      applyCheckIn(registrationId, null);
    } else {
      alert(result.error);
    }
  }

  function handleExportCsv() {
    const headers = ["Name", "Phone", "Email", isPaidSession ? "Payment Status" : null, "Attended", ...customFormFields.map((f) => f.label)].filter(
      (h): h is string => Boolean(h),
    );
    const rows = attendees.map((a) => {
      const payment = latestPaymentByInvitee.get(a.inviteeId);
      const response = responsesByRegistrationId[a.id];
      const base = [a.inviteeName, a.inviteePhone ?? "", a.inviteeEmail ?? ""];
      if (isPaidSession) base.push(payment ? (PAYMENT_LABEL[payment.status] ?? payment.status) : "—");
      base.push(a.attendedAt ? "Yes" : "No");
      for (const field of customFormFields) {
        const value = response?.data[field.id];
        base.push(Array.isArray(value) ? value.join("; ") : value ?? "");
      }
      return base;
    });

    const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sessionTitle.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-attendees.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <QrScanner onScan={handleCheckInByCode} />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (manualCode.trim()) handleCheckInByCode(manualCode);
          }}
          className="flex items-center gap-1.5"
        >
          <input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="Or type check-in code"
            className="w-40 rounded-full border border-navy-950/15 bg-white px-3 py-1.5 text-xs uppercase tracking-wide focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
          />
          <button
            type="submit"
            disabled={checkinBusy === "code" || !manualCode.trim()}
            className="rounded-full border border-navy-950/10 px-3 py-1.5 text-xs font-medium text-navy-700 hover:border-gold-500/40 hover:text-gold-700 disabled:opacity-50"
          >
            {checkinBusy === "code" ? <Loader2 className="animate-spin" size={13} /> : "Check In"}
          </button>
        </form>
        {attendees.length > 0 ? (
          <button
            type="button"
            onClick={handleExportCsv}
            className="ml-auto flex items-center gap-1.5 rounded-full border border-navy-950/10 px-3 py-1.5 text-xs font-medium text-navy-700 hover:border-gold-500/40 hover:text-gold-700"
          >
            <Download size={13} /> Export CSV
          </button>
        ) : null}
      </div>

      {checkinMessage ? (
        <p className={`mt-2 text-xs font-medium ${checkinMessage.tone === "success" ? "text-emerald-600" : "text-red-600"}`}>{checkinMessage.text}</p>
      ) : null}

      {attendees.length === 0 ? (
        <p className="mt-4 text-sm text-navy-700/50">No one has registered yet.</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-lg border border-navy-950/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-navy-950/[0.03] text-xs uppercase tracking-wide text-navy-700/60">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Contact</th>
                {isPaidSession ? <th className="px-3 py-2">Payment</th> : null}
                {customFormFields.map((field) => (
                  <th key={field.id} className="px-3 py-2">
                    {field.label}
                  </th>
                ))}
                <th className="px-3 py-2">Attendance</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-950/5">
              {attendees.map((a) => {
                const payment = latestPaymentByInvitee.get(a.inviteeId);
                const response = responsesByRegistrationId[a.id];
                return (
                  <tr key={a.id}>
                    <td className="px-3 py-2 font-medium text-navy-950">{a.inviteeName}</td>
                    <td className="px-3 py-2 text-navy-700/70">{a.inviteePhone || a.inviteeEmail || "—"}</td>
                    {isPaidSession ? (
                      <td className="px-3 py-2">
                        {payment ? (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PAYMENT_CLASS[payment.status] ?? ""}`}>
                            {PAYMENT_LABEL[payment.status] ?? payment.status}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    ) : null}
                    {customFormFields.map((field) => {
                      const value = response?.data[field.id];
                      return (
                        <td key={field.id} className="px-3 py-2 text-navy-700/70">
                          {Array.isArray(value) ? value.join(", ") : value || "—"}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2">
                      {a.attendedAt ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-emerald-700">
                          <CheckCircle2 size={13} /> Attended
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-navy-700/40">
                          <Circle size={13} /> Not yet
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {a.attendedAt ? (
                        <button
                          type="button"
                          disabled={checkinBusy === a.id}
                          onClick={() => handleUndo(a.id)}
                          className="flex items-center gap-1 text-xs text-navy-700/50 hover:text-red-600"
                        >
                          {checkinBusy === a.id ? <Loader2 className="animate-spin" size={12} /> : <Undo2 size={12} />} Undo
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={checkinBusy === a.id}
                          onClick={() => handleMarkAttended(a.id)}
                          className="rounded-full border border-gold-500/30 px-2.5 py-1 text-xs font-medium text-gold-700 hover:bg-gold-500/10 disabled:opacity-50"
                        >
                          {checkinBusy === a.id ? <Loader2 className="animate-spin" size={12} /> : "Mark Attended"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { getCurrentAdmin } from "@/services/admin-auth";
import { getAssignedSessionIds } from "@/services/session-organizers";
import { getScheduleItemById } from "@/services/event-day";
import { listAttendeesForSession } from "@/services/session-registrations";
import { listRsvpPaymentsForScheduleItem } from "@/services/rsvp-payments";
import type { ScheduleItemRecord } from "@/types/content";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  paid: "Paid",
  failed: "Failed",
  rejected: "Rejected",
};

const STATUS_CLASS: Record<string, string> = {
  pending: "bg-gold-500/15 text-gold-700",
  paid: "bg-emerald-500/15 text-emerald-700",
  failed: "bg-red-500/15 text-red-700",
  rejected: "bg-red-500/15 text-red-700",
};

/**
 * Read-only view for a session_organizer (#63) — their own assigned
 * Event Day session(s) only: who's registered, and (for paid sessions)
 * each guest's payment status. No approve/reject controls here — that
 * stays owner + client only (features/admin/rsvp-payments/actions.ts's
 * requireAdminForPayment explicitly blocks the session_organizer role).
 */
export default async function MySessionsPage() {
  const admin = await getCurrentAdmin();
  if (!admin || admin.role !== "session_organizer") {
    return <p className="text-navy-700">This page is only available to session organizer accounts.</p>;
  }

  const sessionIds = await getAssignedSessionIds(admin.id);
  const sessions = (await Promise.all(sessionIds.map((id) => getScheduleItemById(id)))).filter(
    (s): s is ScheduleItemRecord => Boolean(s),
  );

  if (sessions.length === 0) {
    return (
      <div>
        <h1 className="font-display text-2xl text-navy-950">My Sessions</h1>
        <p className="mt-2 text-sm text-navy-700/60">No sessions have been assigned to your account yet — ask the event host.</p>
      </div>
    );
  }

  const details = await Promise.all(
    sessions.map(async (session) => ({
      session,
      attendees: await listAttendeesForSession(session.id),
      payments: session.isPaidSession ? await listRsvpPaymentsForScheduleItem(session.id) : [],
    })),
  );

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">My Sessions</h1>
      <p className="mt-1 text-sm text-navy-700/60">Attendees and payments for the session(s) you organize — view only.</p>

      <div className="mt-6 grid gap-8">
        {details.map(({ session, attendees, payments }) => (
          <div key={session.id} className="rounded-xl border border-navy-950/10 bg-white p-5">
            <p className="text-xs uppercase tracking-wide text-gold-600">
              {session.startLabel}
              {session.endLabel ? ` – ${session.endLabel}` : ""}
            </p>
            <h2 className="mt-1 font-display text-lg text-navy-950">{session.title}</h2>
            {session.isPaidSession && session.regularPrice ? (
              <p className="mt-1 text-xs text-navy-700/50">
                {session.currency} {session.regularPrice}
                {session.earlyBirdPrice ? ` (early bird ${session.currency} ${session.earlyBirdPrice})` : ""}
              </p>
            ) : session.requiresRegistration ? (
              <p className="mt-1 text-xs text-navy-700/50">Free — registration required</p>
            ) : null}

            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-navy-700/60">
                Registered Attendees ({attendees.length})
              </h3>
              {attendees.length === 0 ? (
                <p className="mt-2 text-sm text-navy-700/50">No one has registered yet.</p>
              ) : (
                <ul className="mt-2 divide-y divide-navy-950/5">
                  {attendees.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                      <span className="font-medium text-navy-950">{a.inviteeName}</span>
                      <span className="text-navy-700/60">{a.inviteePhone || a.inviteeEmail || "—"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {session.isPaidSession ? (
              <div className="mt-5 border-t border-navy-950/10 pt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-navy-700/60">Payments ({payments.length})</h3>
                {payments.length === 0 ? (
                  <p className="mt-2 text-sm text-navy-700/50">No payments yet.</p>
                ) : (
                  <ul className="mt-2 divide-y divide-navy-950/5">
                    {payments.map((p) => (
                      <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                        <span className="font-medium text-navy-950">{p.inviteeName}</span>
                        <span className="text-navy-700/70">
                          {p.currency} {p.amount}
                        </span>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASS[p.status] ?? ""}`}>
                          {STATUS_LABEL[p.status] ?? p.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

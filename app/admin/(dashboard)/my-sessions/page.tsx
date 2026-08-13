import Link from "next/link";
import { Landmark } from "lucide-react";

import { getCurrentAdmin } from "@/services/admin-auth";
import { getAssignedSessionIds } from "@/services/session-organizers";
import { getScheduleItemById } from "@/services/event-day";
import { listAttendeesForSession } from "@/services/session-registrations";
import { listRsvpPaymentsForScheduleItem } from "@/services/rsvp-payments";
import { listFields, listResponsesBySessionRegistrationIds } from "@/services/custom-forms";
import { CopySessionLinkButton } from "@/features/admin/my-sessions/copy-session-link-button";
import { SessionAttendeeTable } from "@/features/admin/session-checkin/session-attendee-table";
import type { ScheduleItemRecord } from "@/types/content";

export const dynamic = "force-dynamic";

/**
 * View for a session_organizer (#63/#106) — their own assigned Event
 * Day session(s) only: share their session's link, submit their own
 * payment method, and now (#106) check guests in — by camera-scanned
 * or manually-typed code, or a "Mark Attended" button — and see the
 * full attendee table (registration + payment + attendance + any
 * linked Custom Form Builder answers), with CSV export. Still no
 * approve/reject control over payments themselves — that stays owner +
 * client only (features/admin/rsvp-payments/actions.ts's
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
    sessions.map(async (session) => {
      const attendees = await listAttendeesForSession(session.id);
      const [payments, customFormFields, responsesByRegistrationId] = await Promise.all([
        session.isPaidSession ? listRsvpPaymentsForScheduleItem(session.id) : Promise.resolve([]),
        session.customFormId ? listFields(session.customFormId) : Promise.resolve([]),
        listResponsesBySessionRegistrationIds(attendees.map((a) => a.id)),
      ]);
      return { session, attendees, payments, customFormFields, responsesByRegistrationId };
    }),
  );

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">My Sessions</h1>
      <p className="mt-1 text-sm text-navy-700/60">Attendees and payments for the session(s) you organize — view only.</p>

      <div className="mt-6 grid gap-8">
        {details.map(({ session, attendees, payments, customFormFields, responsesByRegistrationId }) => (
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

            {session.requiresRegistration ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <CopySessionLinkButton scheduleItemId={session.id} initialToken={session.shareToken} />
                {session.isPaidSession ? (
                  <Link
                    href={`/admin/payment-settings-request?scheduleItemId=${session.id}`}
                    className="flex items-center gap-1.5 rounded-full border border-navy-950/10 px-3 py-1.5 text-xs font-medium text-navy-700 hover:border-gold-500/40 hover:text-gold-700"
                  >
                    <Landmark size={13} /> My Payment Settings
                  </Link>
                ) : null}
              </div>
            ) : null}

            <div className="mt-5 border-t border-navy-950/10 pt-4">
              <SessionAttendeeTable
                scheduleItemId={session.id}
                sessionTitle={session.title}
                isPaidSession={session.isPaidSession}
                initialAttendees={attendees}
                initialPayments={payments}
                customFormFields={customFormFields}
                responsesByRegistrationId={responsesByRegistrationId}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

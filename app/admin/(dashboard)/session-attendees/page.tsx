import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/services/admin-auth";
import { resolveAdminEvent } from "@/lib/admin-event";
import { shouldRedirectOrganizerAway, shouldRedirectSessionOrganizerAway } from "@/lib/admin-roles";
import { listScheduleItems } from "@/services/event-day";
import { listAttendeesForSession } from "@/services/session-registrations";
import { listRsvpPaymentsForScheduleItem } from "@/services/rsvp-payments";
import { listFields, listResponsesBySessionRegistrationIds } from "@/services/custom-forms";
import { SessionAttendeeTable } from "@/features/admin/session-checkin/session-attendee-table";

export const dynamic = "force-dynamic";

/**
 * Host (owner/client) view across EVERY session in the event that
 * requires registration (#106) — the "My Sessions" equivalent for a
 * host who isn't scoped to just one session. Same SessionAttendeeTable
 * component as /admin/my-sessions, so check-in, payment status, and
 * linked custom-form columns behave identically for both audiences.
 */
export default async function SessionAttendeesPage() {
  const admin = await getCurrentAdmin();
  if (admin && shouldRedirectSessionOrganizerAway(admin.role)) redirect("/admin/my-sessions");
  if (admin && shouldRedirectOrganizerAway(admin.role)) redirect("/admin/invitees");

  const event = admin ? await resolveAdminEvent(admin) : null;
  if (!event) {
    return <p className="text-navy-700">No event is assigned to this account yet.</p>;
  }

  const allItems = await listScheduleItems(event.id);
  const sessions = allItems.filter((item) => item.requiresRegistration);

  if (sessions.length === 0) {
    return (
      <div>
        <h1 className="font-display text-2xl text-navy-950">Session Attendees</h1>
        <p className="mt-2 text-sm text-navy-700/60">
          No sessions require registration yet — turn on registration for a schedule item under Event Day to start collecting
          attendees here.
        </p>
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
      <h1 className="font-display text-2xl text-navy-950">Session Attendees</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        Registration, payment, attendance, and any extra questions answered — for every session that requires registration.
      </p>

      <div className="mt-6 grid gap-8">
        {details.map(({ session, attendees, payments, customFormFields, responsesByRegistrationId }) => (
          <div key={session.id} className="rounded-xl border border-navy-950/10 bg-white p-5">
            <p className="text-xs uppercase tracking-wide text-gold-600">
              {session.startLabel}
              {session.endLabel ? ` – ${session.endLabel}` : ""}
            </p>
            <h2 className="mt-1 font-display text-lg text-navy-950">{session.title}</h2>

            <div className="mt-4">
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

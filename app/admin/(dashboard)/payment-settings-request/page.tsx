import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/services/admin-auth";
import { resolveAdminEvent } from "@/lib/admin-event";
import { shouldRedirectOrganizerAway } from "@/lib/admin-roles";
import { getEventPaymentSettingsSummary } from "@/services/event-payment-settings";
import { getScheduleItemById } from "@/services/event-day";
import { getAssignedSessionIds } from "@/services/session-organizers";
import { PaymentSettingsForm } from "@/features/admin/event-payment-settings/payment-settings-form";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ scheduleItemId?: string }>;
}

export default async function EventPaymentSettingsRequestPage({ searchParams }: PageProps) {
  const { scheduleItemId } = await searchParams;
  const admin = await getCurrentAdmin();
  if (admin && shouldRedirectOrganizerAway(admin.role)) redirect("/admin/invitees");

  // #106: a session_organizer may reach this page ONLY for their own
  // assigned session, via a scheduleItemId that's re-verified against
  // session_organizer_assignments — never the general owner/client flow
  // below (resolveAdminEvent doesn't apply to this role at all).
  if (admin?.role === "session_organizer") {
    if (!scheduleItemId) redirect("/admin/my-sessions");
    const assignedIds = await getAssignedSessionIds(admin.id);
    if (!assignedIds.includes(scheduleItemId)) redirect("/admin/my-sessions");

    const session = await getScheduleItemById(scheduleItemId);
    if (!session) redirect("/admin/my-sessions");

    const existing = await getEventPaymentSettingsSummary(session.eventId, scheduleItemId);

    return (
      <div>
        <h1 className="font-display text-2xl text-navy-950">Payment Settings — {session.title}</h1>
        <p className="mt-1 text-sm text-navy-700/60">
          Set how guests pay to register for your session. The site owner reviews every submission before it goes live.
        </p>
        <div className="mt-6">
          <PaymentSettingsForm
            eventId={session.eventId}
            existing={existing}
            scheduleItemId={session.id}
            sessionTitle={session.title}
            asSessionOrganizer
          />
        </div>
      </div>
    );
  }

  const event = admin ? await resolveAdminEvent(admin) : null;
  if (!event) {
    return <p className="text-navy-700">No event is assigned to this account yet.</p>;
  }

  // A session id in the URL only counts if it actually belongs to this event — otherwise silently fall back to the event default, same defense-in-depth as every other id-from-a-URL lookup in this app.
  let sessionTitle: string | null = null;
  let effectiveScheduleItemId: string | null = null;
  if (scheduleItemId) {
    const session = await getScheduleItemById(scheduleItemId);
    if (session && session.eventId === event.id) {
      sessionTitle = session.title;
      effectiveScheduleItemId = session.id;
    }
  }

  const existing = await getEventPaymentSettingsSummary(event.id, effectiveScheduleItemId);

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">{sessionTitle ? `Payment Settings — ${sessionTitle}` : "Payment Settings"}</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        {sessionTitle
          ? "Set a payment method just for this session — guests registering for it will pay through this instead of your event's default."
          : "Add your own bank/UPI details or payment gateway keys so guests can pay to register — e.g. for a paid workshop."}{" "}
        The site owner reviews every submission before it goes live.
      </p>
      <div className="mt-6">
        <PaymentSettingsForm eventId={event.id} existing={existing} scheduleItemId={effectiveScheduleItemId} sessionTitle={sessionTitle} />
      </div>
    </div>
  );
}

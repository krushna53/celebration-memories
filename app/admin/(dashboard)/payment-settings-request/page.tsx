import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/services/admin-auth";
import { resolveAdminEvent } from "@/lib/admin-event";
import { shouldRedirectOrganizerAway, shouldRedirectSessionOrganizerAway } from "@/lib/admin-roles";
import { getEventPaymentSettingsSummary } from "@/services/event-payment-settings";
import { getScheduleItemById } from "@/services/event-day";
import { PaymentSettingsForm } from "@/features/admin/event-payment-settings/payment-settings-form";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ scheduleItemId?: string }>;
}

export default async function EventPaymentSettingsRequestPage({ searchParams }: PageProps) {
  const { scheduleItemId } = await searchParams;
  const admin = await getCurrentAdmin();
  if (admin && shouldRedirectSessionOrganizerAway(admin.role)) redirect("/admin/my-sessions");
  if (admin && shouldRedirectOrganizerAway(admin.role)) redirect("/admin/invitees");
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

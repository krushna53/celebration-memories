import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/services/admin-auth";
import { resolveAdminEvent } from "@/lib/admin-event";
import { shouldRedirectOrganizerAway, shouldRedirectSessionOrganizerAway } from "@/lib/admin-roles";
import { listRsvpPaymentsForEvent } from "@/services/rsvp-payments";
import { RsvpPaymentList } from "@/features/admin/rsvp-payments/rsvp-payment-list";

export const dynamic = "force-dynamic";

// Whole-event payment list — session_organizer is redirected to
// /admin/my-sessions instead, which shows only their own session's
// payments (services/rsvp-payments.ts's listRsvpPaymentsForScheduleItem).
export default async function RsvpPaymentsPage() {
  const admin = await getCurrentAdmin();
  if (admin && shouldRedirectSessionOrganizerAway(admin.role)) redirect("/admin/my-sessions");
  if (admin && shouldRedirectOrganizerAway(admin.role)) redirect("/admin/invitees");
  const event = admin ? await resolveAdminEvent(admin) : null;
  if (!event) {
    return <p className="text-navy-700">No event is assigned to this account yet.</p>;
  }

  const items = await listRsvpPaymentsForEvent(event.id);

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">RSVP Payments</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        Every payment attempt against this event&rsquo;s paid RSVP. Bank/UPI payments need your approval; card
        payments are confirmed automatically.
      </p>
      <div className="mt-6">
        <RsvpPaymentList initialItems={items} />
      </div>
    </div>
  );
}

import { getCurrentAdmin } from "@/services/admin-auth";
import { resolveAdminEvent } from "@/lib/admin-event";
import { getEventPaymentSettingsSummary } from "@/services/event-payment-settings";
import { PaymentSettingsForm } from "@/features/admin/event-payment-settings/payment-settings-form";

export const dynamic = "force-dynamic";

export default async function EventPaymentSettingsRequestPage() {
  const admin = await getCurrentAdmin();
  const event = admin ? await resolveAdminEvent(admin) : null;
  if (!event) {
    return <p className="text-navy-700">No event is assigned to this account yet.</p>;
  }

  const existing = await getEventPaymentSettingsSummary(event.id);

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Payment Settings</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        Add your own bank/UPI details or payment gateway keys so guests can pay to register — e.g. for a paid
        workshop. The site owner reviews every submission before it goes live.
      </p>
      <div className="mt-6">
        <PaymentSettingsForm eventId={event.id} existing={existing} />
      </div>
    </div>
  );
}

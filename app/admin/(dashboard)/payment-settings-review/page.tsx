import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/services/admin-auth";
import { listEventPaymentSettings } from "@/services/event-payment-settings";
import { PaymentSettingsReviewList } from "@/features/admin/payment-settings-review/payment-settings-review-list";

export const dynamic = "force-dynamic";

export default async function PaymentSettingsReviewPage() {
  const admin = await getCurrentAdmin();
  if (admin?.role !== "owner") redirect("/admin");

  const items = await listEventPaymentSettings();

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Payment Settings Approvals</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        Clients submit their own bank/UPI details or gateway keys so guests can pay to register (e.g. a paid
        workshop) — review and approve before any of these go live.
      </p>
      <div className="mt-6">
        <PaymentSettingsReviewList initialItems={items} />
      </div>
    </div>
  );
}

import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/services/admin-auth";
import { listPaymentSubmissions } from "@/services/payments";
import { PaymentSubmissionList } from "@/features/admin/payments/payment-submission-list";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  const admin = await getCurrentAdmin();
  if (admin?.role !== "owner") redirect("/admin");

  const submissions = await listPaymentSubmissions();

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Payments</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        Confirmations submitted from the public{" "}
        <code className="rounded bg-navy-950/5 px-1 py-0.5">/pay</code> page. Verify each
        against your bank/UPI app before marking it confirmed — nothing here moves money
        automatically.
      </p>
      <div className="mt-6">
        <PaymentSubmissionList initialSubmissions={submissions} />
      </div>
    </div>
  );
}

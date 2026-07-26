import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/services/admin-auth";
import { getPaymentSettings } from "@/services/payments";
import { publicMediaUrl } from "@/services/uploads";
import { PaymentSettingsForm } from "@/features/admin/payment-settings/payment-settings-form";

export const dynamic = "force-dynamic";

export default async function AdminPaymentSettingsPage() {
  const admin = await getCurrentAdmin();
  if (admin?.role !== "owner") redirect("/admin");

  const settings = await getPaymentSettings();
  const qrImageUrl = settings.qrImagePath ? publicMediaUrl("gallery", settings.qrImagePath) : null;

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Payment Settings</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        Set up the QR code and payment details shown at the public{" "}
        <code className="rounded bg-navy-950/5 px-1 py-0.5">/pay</code> page. This is a
        manual flow — no money moves through the platform, payers just confirm what
        they sent and you verify it yourself in the Payments queue.
      </p>
      <div className="mt-6">
        <PaymentSettingsForm settings={settings} qrImageUrl={qrImageUrl} />
      </div>
    </div>
  );
}

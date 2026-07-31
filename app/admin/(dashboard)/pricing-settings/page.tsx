import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/services/admin-auth";
import { getPricingPlanSettings } from "@/services/pricing-settings";
import { PricingSettingsForm } from "@/features/admin/pricing-settings/pricing-settings-form";

export const dynamic = "force-dynamic";

export default async function AdminPricingSettingsPage() {
  const admin = await getCurrentAdmin();
  if (admin?.role !== "owner") redirect("/admin");

  const plans = await getPricingPlanSettings();

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Pricing Settings</h1>
      <p className="mt-1 max-w-2xl text-sm text-navy-700/60">
        Change the Free and Pro prices shown on the public{" "}
        <code className="rounded bg-navy-950/5 px-1 py-0.5">/pricing</code> page — changes go live immediately, no
        deploy needed. This only controls the marketing display and what a new draft&rsquo;s AI credit limits are set
        to; it does not change what the wizard&rsquo;s checkout step actually charges (that&rsquo;s configured
        separately via Stripe/Razorpay under Billing).
      </p>

      <div className="mt-6">
        <PricingSettingsForm plans={plans} />
      </div>
    </div>
  );
}

import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/services/admin-auth";
import { getBillingProvider } from "@/services/billing-settings";
import { listWizardPayments } from "@/services/wizard-payments";
import { STRIPE_CONFIGURED } from "@/lib/stripe";
import { RAZORPAY_CONFIGURED } from "@/lib/razorpay";
import { ProviderSwitcher } from "@/features/admin/billing/provider-switcher";

export const dynamic = "force-dynamic";

function formatAmount(amount: number, currency: string): string {
  if (amount === 0) return "Free";
  // Stripe/Razorpay both report amounts in the smallest currency unit.
  const major = amount / 100;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(major);
  } catch {
    return `${major.toFixed(2)} ${currency.toUpperCase()}`;
  }
}

const PROVIDER_LABEL: Record<string, string> = { stripe: "Stripe", razorpay: "Razorpay", promo: "Promo Code" };

export default async function AdminBillingPage() {
  const admin = await getCurrentAdmin();
  if (admin?.role !== "owner") redirect("/admin");

  const [provider, payments] = await Promise.all([getBillingProvider(), listWizardPayments()]);

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Billing</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        Revenue from the self-serve wizard (<code className="rounded bg-navy-950/5 px-1 py-0.5">/start</code>) —
        separate from the guest-facing manual UPI/QR flow under Payments.
      </p>

      <section className="mt-6 rounded-xl border border-navy-950/10 bg-white p-5">
        <h2 className="font-display text-lg text-navy-950">Checkout Provider</h2>
        <p className="mt-1 text-sm text-navy-700/60">Which processor new hosts pay through.</p>
        <div className="mt-4">
          <ProviderSwitcher
            currentProvider={provider}
            stripeConfigured={STRIPE_CONFIGURED}
            razorpayConfigured={RAZORPAY_CONFIGURED}
          />
        </div>
      </section>

      <section className="mt-6">
        <h2 className="font-display text-lg text-navy-950">Activations</h2>
        {payments.length === 0 ? (
          <p className="mt-2 text-sm text-navy-700/60">No paid or promo activations yet.</p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-xl border border-navy-950/10 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-navy-950/5 text-xs uppercase tracking-wide text-navy-700/60">
                <tr>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-950/5">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-navy-950">{p.honoreeName || "—"}</div>
                      <div className="text-xs text-navy-700/50">{p.eventSlug}</div>
                    </td>
                    <td className="px-4 py-3 text-navy-700/70">
                      {PROVIDER_LABEL[p.provider] ?? p.provider}
                      {p.promoCode ? <span className="ml-1 text-xs text-navy-700/40">({p.promoCode})</span> : null}
                    </td>
                    <td className="px-4 py-3 text-navy-700/70">{p.plan === "one_time" ? "One-Time" : "Subscription"}</td>
                    <td className="px-4 py-3 text-navy-700/70">{formatAmount(p.amount, p.currency)}</td>
                    <td className="px-4 py-3 text-navy-700/70">
                      {new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

export type BillingProviderRecord = "stripe" | "razorpay" | "ccavenue" | "promo";
export type BillingPlanRecord = "one_time" | "subscription";

export interface WizardPaymentRecord {
  id: string;
  eventId: string;
  eventSlug: string;
  honoreeName: string;
  provider: BillingProviderRecord;
  plan: BillingPlanRecord;
  /** Smallest currency unit (cents/paise). 0 for promo-activated events. */
  amount: number;
  currency: string;
  externalId: string | null;
  promoCode: string | null;
  createdAt: string;
}

/**
 * Records one successful wizard activation, from whichever path
 * produced it: Stripe webhook, Razorpay webhook, or a promo code
 * redemption. Powers the owner-only /admin/billing page. Deliberately
 * separate from services/payments.ts's payment_submissions, which is
 * the unrelated guest-facing manual UPI/QR flow at /pay.
 */
export async function recordWizardPayment(params: {
  eventId: string;
  adminId: string | null;
  provider: BillingProviderRecord;
  plan: BillingPlanRecord;
  amount: number;
  currency: string;
  externalId?: string | null;
  promoCode?: string | null;
}): Promise<void> {
  const { error } = await supabaseAdmin().from("wizard_payments").insert({
    event_id: params.eventId,
    admin_id: params.adminId,
    provider: params.provider,
    plan: params.plan,
    amount: params.amount,
    currency: params.currency,
    external_id: params.externalId ?? null,
    promo_code: params.promoCode ?? null,
  });

  if (error) console.error("recordWizardPayment failed:", error.message);
}

interface WizardPaymentRow {
  id: string;
  event_id: string;
  provider: BillingProviderRecord;
  plan: BillingPlanRecord;
  amount: number;
  currency: string;
  external_id: string | null;
  promo_code: string | null;
  created_at: string;
  events: { slug: string; honoree_name: string } | null;
}

export async function listWizardPayments(): Promise<WizardPaymentRecord[]> {
  const { data, error } = await supabaseAdmin()
    .from("wizard_payments")
    .select("id, event_id, provider, plan, amount, currency, external_id, promo_code, created_at, events(slug, honoree_name)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("listWizardPayments failed:", error.message);
    return [];
  }

  return (data as unknown as WizardPaymentRow[]).map((row) => ({
    id: row.id,
    eventId: row.event_id,
    eventSlug: row.events?.slug ?? "",
    honoreeName: row.events?.honoree_name ?? "",
    provider: row.provider,
    plan: row.plan,
    amount: row.amount,
    currency: row.currency,
    externalId: row.external_id,
    promoCode: row.promo_code,
    createdAt: row.created_at,
  }));
}

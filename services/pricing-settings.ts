import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

export type PricingPlanId = "free" | "pro";

export interface PricingPlanSetting {
  id: PricingPlanId;
  name: string;
  monthlyUsd: number;
  monthlyInr: number;
  annualUsd: number;
  annualInr: number;
}

export interface PricingPlanInput {
  monthlyUsd: number;
  monthlyInr: number;
  annualUsd: number;
  annualInr: number;
}

/**
 * Hardcoded fallback if the DB read fails or the table is somehow
 * empty — keeps /pricing rendering something sane instead of crashing.
 * Kept in sync with the seed values from the add_pricing_plan_settings
 * migration, not with the actual live values (which the owner may have
 * since changed from /admin/pricing-settings).
 */
const FALLBACKS: Record<PricingPlanId, PricingPlanSetting> = {
  free: { id: "free", name: "Free", monthlyUsd: 0, monthlyInr: 0, annualUsd: 0, annualInr: 0 },
  pro: { id: "pro", name: "Pro", monthlyUsd: 19, monthlyInr: 1499, annualUsd: 179, annualInr: 13999 },
};

interface PricingPlanRow {
  id: string;
  name: string;
  monthly_usd: number | string;
  monthly_inr: number | string;
  annual_usd: number | string;
  annual_inr: number | string;
}

function rowToSetting(row: PricingPlanRow): PricingPlanSetting {
  return {
    id: row.id as PricingPlanId,
    name: row.name,
    monthlyUsd: Number(row.monthly_usd),
    monthlyInr: Number(row.monthly_inr),
    annualUsd: Number(row.annual_usd),
    annualInr: Number(row.annual_inr),
  };
}

/**
 * Owner-editable Free/Pro prices shown on /pricing — see
 * features/admin/pricing-settings for the admin UI that writes these,
 * and features/pricing/photographer-pricing-plans.tsx for where they're
 * rendered. This only controls the /pricing marketing display; it does
 * NOT change what the wizard's payment step actually charges (that's a
 * separate one-time/subscription amount configured via Stripe/Razorpay
 * — see lib/stripe.ts, lib/razorpay.ts, features/start/actions/payment.ts).
 * The two aren't wired together today.
 */
export async function getPricingPlanSettings(): Promise<Record<PricingPlanId, PricingPlanSetting>> {
  const { data, error } = await supabaseAdmin()
    .from("pricing_plan_settings")
    .select("id, name, monthly_usd, monthly_inr, annual_usd, annual_inr");

  if (error || !data || data.length === 0) {
    if (error) console.error("getPricingPlanSettings failed, using fallbacks:", error.message);
    return FALLBACKS;
  }

  const result = { ...FALLBACKS };
  for (const row of data as PricingPlanRow[]) {
    if (row.id === "free" || row.id === "pro") {
      result[row.id] = rowToSetting(row);
    }
  }
  return result;
}

export async function updatePricingPlanSetting(id: PricingPlanId, input: PricingPlanInput): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("pricing_plan_settings")
    .update({
      monthly_usd: input.monthlyUsd,
      monthly_inr: input.monthlyInr,
      annual_usd: input.annualUsd,
      annual_inr: input.annualInr,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(`Failed to update pricing for "${id}": ${error.message}`);
}

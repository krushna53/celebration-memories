import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

export type BillingProvider = "stripe" | "razorpay";

/**
 * Single global setting (billing_settings, a singleton row) controlling
 * which processor the wizard's payment step uses — owner-configurable
 * from /admin/billing (features/admin/billing/provider-switcher.tsx).
 * Defaults to 'stripe'. Both processors' env vars can be present at
 * once; only this setting decides which one is actually offered to
 * hosts at checkout time.
 */
export async function getBillingProvider(): Promise<BillingProvider> {
  const { data, error } = await supabaseAdmin()
    .from("billing_settings")
    .select("provider")
    .eq("id", true)
    .maybeSingle<{ provider: BillingProvider }>();

  if (error) {
    console.error("getBillingProvider failed, defaulting to stripe:", error.message);
    return "stripe";
  }
  return data?.provider ?? "stripe";
}

export async function setBillingProvider(provider: BillingProvider): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("billing_settings")
    .update({ provider, updated_at: new Date().toISOString() })
    .eq("id", true);

  if (error) throw new Error(`Failed to update billing provider: ${error.message}`);
}

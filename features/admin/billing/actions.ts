"use server";

import { revalidatePath } from "next/cache";

import { requireOwner } from "@/services/admin-auth";
import { setBillingProvider, type BillingProvider } from "@/services/billing-settings";
import {
  updateRazorpaySettings,
  updateStripeSettings,
  type RazorpaySettingsInput,
  type StripeSettingsInput,
} from "@/services/payment-settings";

export type AdminActionResult = { success: true } | { success: false; error: string };

/** Owner-only — switches which processor the wizard's payment step offers. See services/billing-settings.ts. */
export async function setBillingProviderAction(provider: BillingProvider): Promise<AdminActionResult> {
  try {
    await requireOwner();
    await setBillingProvider(provider);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update." };
  }
}

/**
 * Owner-only — updates any subset of the Razorpay credentials/plan IDs
 * stored in payment_provider_settings (see services/payment-settings.ts).
 * Blank fields in the form are omitted entirely rather than sent as
 * empty strings, so submitting the form without touching a field never
 * overwrites an already-saved secret with blank.
 */
export async function updateRazorpaySettingsAction(input: RazorpaySettingsInput): Promise<AdminActionResult> {
  try {
    await requireOwner();
    await updateRazorpaySettings(input);
    revalidatePath("/admin/billing");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update Razorpay settings." };
  }
}

/** Owner-only — same as updateRazorpaySettingsAction, for Stripe. */
export async function updateStripeSettingsAction(input: StripeSettingsInput): Promise<AdminActionResult> {
  try {
    await requireOwner();
    await updateStripeSettings(input);
    revalidatePath("/admin/billing");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update Stripe settings." };
  }
}

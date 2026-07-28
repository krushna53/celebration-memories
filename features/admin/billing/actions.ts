"use server";

import { requireOwner } from "@/services/admin-auth";
import { setBillingProvider, type BillingProvider } from "@/services/billing-settings";

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

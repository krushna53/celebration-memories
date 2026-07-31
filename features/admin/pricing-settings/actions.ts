"use server";

import { revalidatePath } from "next/cache";

import { requireOwner } from "@/services/admin-auth";
import { updatePricingPlanSetting, type PricingPlanId, type PricingPlanInput } from "@/services/pricing-settings";

export type PricingSettingsActionResult = { success: true } | { success: false; error: string };

/** Owner-only — edits the Free/Pro prices shown on the public /pricing page. See services/pricing-settings.ts. */
export async function updatePricingPlanAction(
  id: PricingPlanId,
  input: PricingPlanInput,
): Promise<PricingSettingsActionResult> {
  try {
    await requireOwner();
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Not authorized." };
  }

  const values = [
    input.monthlyUsd,
    input.monthlyInr,
    input.annualUsd,
    input.annualInr,
    input.aiImageGenerationLimit,
    input.slideshowVideoGenerationLimit,
  ];
  if (values.some((n) => !Number.isFinite(n) || n < 0)) {
    return { success: false, error: "Prices and AI credit limits must be zero or a positive number." };
  }
  if (!Number.isInteger(input.aiImageGenerationLimit) || !Number.isInteger(input.slideshowVideoGenerationLimit)) {
    return { success: false, error: "AI credit limits must be whole numbers." };
  }

  try {
    await updatePricingPlanSetting(id, input);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to save pricing." };
  }

  revalidatePath("/pricing");
  revalidatePath("/admin/pricing-settings");
  return { success: true };
}

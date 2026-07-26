"use server";

import { revalidatePath } from "next/cache";

import { getCurrentAdmin } from "@/services/admin-auth";
import {
  addReferralConversion,
  createReferralCode,
  setConversionPayoutStatus,
} from "@/services/referrals";

export type ReferralActionResult = { success: true } | { success: false; error: string };

export async function createReferralCodeAction(
  label: string,
  whatsapp: string | null,
): Promise<ReferralActionResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { success: false, error: "Not authorized." };

  if (!label.trim()) return { success: false, error: "Please enter a name for this referrer." };

  try {
    await createReferralCode({ label: label.trim(), whatsapp });
    revalidatePath("/admin/referrals");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function addReferralConversionAction(
  referralCodeId: string,
  note: string,
  rewardAmount: number | null,
): Promise<ReferralActionResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { success: false, error: "Not authorized." };

  if (!note.trim()) return { success: false, error: "Please describe what this referral led to." };

  try {
    await addReferralConversion({ referralCodeId, note: note.trim(), rewardAmount });
    revalidatePath("/admin/referrals");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function setConversionPayoutStatusAction(
  conversionId: string,
  status: "pending" | "paid",
): Promise<ReferralActionResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { success: false, error: "Not authorized." };

  try {
    await setConversionPayoutStatus(conversionId, status);
    revalidatePath("/admin/referrals");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

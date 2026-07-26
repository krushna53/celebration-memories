"use server";

import { revalidatePath } from "next/cache";

import { requireOwner } from "@/services/admin-auth";
import {
  addReferralConversion,
  createReferralCode,
  setConversionPayoutStatus,
} from "@/services/referrals";

export type ReferralActionResult = { success: true } | { success: false; error: string };

// Referrals is owner-only (agency payout tracking) — every action here
// re-checks role via requireOwner(), independent of the page-level guard.

export async function createReferralCodeAction(
  label: string,
  whatsapp: string | null,
): Promise<ReferralActionResult> {
  try {
    await requireOwner();
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Not authorized." };
  }

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
  try {
    await requireOwner();
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Not authorized." };
  }

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
  try {
    await requireOwner();
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Not authorized." };
  }

  try {
    await setConversionPayoutStatus(conversionId, status);
    revalidatePath("/admin/referrals");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

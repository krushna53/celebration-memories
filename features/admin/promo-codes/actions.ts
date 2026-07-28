"use server";

import { requireOwner } from "@/services/admin-auth";
import { createPromoCode, setPromoCodeActive } from "@/services/promo-codes";

export type AdminActionResult = { success: true } | { success: false; error: string };

export async function createPromoCodeAction(input: {
  code: string;
  description?: string;
  maxRedemptions?: number | null;
}): Promise<AdminActionResult> {
  try {
    await requireOwner();
    if (!input.code.trim()) return { success: false, error: "Enter a code." };
    await createPromoCode({
      code: input.code,
      description: input.description || null,
      maxRedemptions: input.maxRedemptions ?? null,
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to create code." };
  }
}

export async function setPromoCodeActiveAction(id: string, active: boolean): Promise<AdminActionResult> {
  try {
    await requireOwner();
    await setPromoCodeActive(id, active);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update." };
  }
}

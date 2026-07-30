"use server";

import { revalidatePath } from "next/cache";

import { getCurrentAdmin } from "@/services/admin-auth";
import { regenerateMobileAccessCode } from "@/services/admin-mobile-auth";

export type RegenerateResult = { success: true; code: string } | { success: false; error: string };

/**
 * Regenerates the signed-in admin's own mobile access code — always
 * scoped to "myself" (via getCurrentAdmin(), not a client-supplied
 * admin id), since there's no scenario where one admin should be able
 * to rotate another admin's mobile credential from this card. Signs out
 * every phone currently using the old code (see
 * services/admin-mobile-auth.ts's regenerateMobileAccessCode).
 */
export async function regenerateMobileAccessCodeAction(): Promise<RegenerateResult> {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return { success: false, error: "Not authorized." };
  }

  try {
    const code = await regenerateMobileAccessCode(admin.id);
    revalidatePath("/admin/simple");
    return { success: true, code };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to generate a new code." };
  }
}

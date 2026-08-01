"use server";

import { revalidatePath } from "next/cache";

import { requireBusinessAccount } from "@/services/business-auth";
import { regenerateBusinessMobileAccessCode } from "@/services/business-mobile-auth";

export type RegenerateResult = { success: true; code: string } | { success: false; error: string };

/** Regenerates the signed-in vendor's own mobile access code — see services/business-mobile-auth.ts. Signs out every phone currently using the old code. */
export async function regenerateBusinessMobileAccessCodeAction(): Promise<RegenerateResult> {
  try {
    const account = await requireBusinessAccount();
    const code = await regenerateBusinessMobileAccessCode(account.id);
    revalidatePath("/business/dashboard");
    return { success: true, code };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to generate a new code." };
  }
}

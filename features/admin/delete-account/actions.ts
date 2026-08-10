"use server";

import { getCurrentAdmin } from "@/services/admin-auth";
import { requestAccountDeletionCode, confirmAccountDeletion } from "@/services/account-deletion-verification";
import { supabaseServer } from "@/lib/supabase/server";

export type RequestCodeResult = { success: true; eventTitle: string } | { success: false; error: string };

export async function requestAccountDeletionCodeAction(): Promise<RequestCodeResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { success: false, error: "Not authorized." };
  return requestAccountDeletionCode(admin.id);
}

export type ConfirmDeletionResult = { success: true } | { success: false; error: string };

/**
 * On success, the account (and its Supabase Auth user) no longer
 * exists — this also explicitly signs out the current session
 * afterward so the browser doesn't keep behaving as if still logged
 * in, then the client component redirects to the homepage.
 */
export async function confirmAccountDeletionAction(code: string, confirmText: string): Promise<ConfirmDeletionResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { success: false, error: "Not authorized." };
  if (confirmText.trim().toUpperCase() !== "DELETE") {
    return { success: false, error: 'Type "DELETE" to confirm.' };
  }

  const result = await confirmAccountDeletion(admin.id, code);
  if (!result.success) return result;

  try {
    const session = await supabaseServer();
    await session.auth.signOut();
  } catch {
    // Best-effort — the account is already gone either way.
  }

  return { success: true };
}

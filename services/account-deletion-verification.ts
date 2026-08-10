import "server-only";
import { randomInt } from "node:crypto";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendAccountDeletionCode } from "@/lib/email";
import { deleteAdminAccountAndAssets } from "@/services/admin-danger-zone";
import { getEventById } from "@/services/events";

const CODE_VALID_MINUTES = 15;

interface AdminForDeletionRow {
  id: string;
  email: string;
  role: "owner" | "client" | "session_organizer";
  event_id: string | null;
}

/**
 * Client self-serve account deletion (task #71) — the emailed one-time-
 * code gate in front of the already-existing, owner-only
 * deleteAdminAccountAndAssets (services/admin-danger-zone.ts). Reuses
 * that function's cascade-delete/Storage-cleanup entirely; this file
 * only adds the "prove you still control this email" checkpoint a
 * self-serve destructive action needs that an owner-performed deletion
 * doesn't (the owner is already a trusted operator confirming someone
 * else's email, not their own).
 */

function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export type RequestDeletionCodeResult =
  | { success: true; eventTitle: string }
  | { success: false; error: string };

/**
 * Only ever callable for role === "client" — owner accounts must never
 * be deletable this way (deleteAdminAccountAndAssets already refuses an
 * owner too, defense-in-depth), and session_organizer has nothing of
 * its own to delete (removing them is the client/owner's call, via
 * Session Organizers management, not a self-serve destructive action).
 */
export async function requestAccountDeletionCode(adminId: string): Promise<RequestDeletionCodeResult> {
  const client = supabaseAdmin();

  const { data: adminRow, error: lookupError } = await client
    .from("admins")
    .select("id, email, role, event_id")
    .eq("id", adminId)
    .maybeSingle<AdminForDeletionRow>();

  if (lookupError) return { success: false, error: `Failed to look up account: ${lookupError.message}` };
  if (!adminRow) return { success: false, error: "Account not found." };
  if (adminRow.role !== "client") {
    return { success: false, error: "Only a client (event host) account can be deleted this way." };
  }
  if (!adminRow.event_id) {
    return { success: false, error: "No event is linked to this account." };
  }

  const event = await getEventById(adminRow.event_id);
  if (!event) return { success: false, error: "This account's event couldn't be found." };

  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_VALID_MINUTES * 60 * 1000).toISOString();

  const { error: updateError } = await client
    .from("admins")
    .update({ deletion_code: code, deletion_code_expires_at: expiresAt })
    .eq("id", adminId);
  if (updateError) return { success: false, error: `Failed to prepare deletion code: ${updateError.message}` };

  await sendAccountDeletionCode({
    to: adminRow.email,
    code,
    eventTitle: `${event.honoreeName}'s ${event.eventTitle}`,
    minutesValid: CODE_VALID_MINUTES,
  });

  return { success: true, eventTitle: `${event.honoreeName}'s ${event.eventTitle}` };
}

export type ConfirmAccountDeletionResult = { success: true } | { success: false; error: string };

/**
 * Verifies the emailed code (and that it hasn't expired), then runs the
 * real, irreversible deletion. The code is single-use — cleared
 * immediately on a successful match so it can never be replayed, and
 * also cleared on a wrong/expired attempt isn't necessary since it's
 * short-lived anyway, but we leave it be so a mistyped code can be
 * retried within the same window.
 */
export async function confirmAccountDeletion(adminId: string, code: string): Promise<ConfirmAccountDeletionResult> {
  const client = supabaseAdmin();

  const { data: adminRow, error: lookupError } = await client
    .from("admins")
    .select("id, email, role, event_id, deletion_code, deletion_code_expires_at")
    .eq("id", adminId)
    .maybeSingle<AdminForDeletionRow & { deletion_code: string | null; deletion_code_expires_at: string | null }>();

  if (lookupError) return { success: false, error: `Failed to look up account: ${lookupError.message}` };
  if (!adminRow) return { success: false, error: "Account not found." };
  if (adminRow.role !== "client") {
    return { success: false, error: "Only a client (event host) account can be deleted this way." };
  }
  if (!adminRow.deletion_code || !adminRow.deletion_code_expires_at) {
    return { success: false, error: "Request a code first." };
  }
  if (new Date(adminRow.deletion_code_expires_at).getTime() < Date.now()) {
    return { success: false, error: "That code has expired — request a new one." };
  }
  if (adminRow.deletion_code !== code.trim()) {
    return { success: false, error: "That code doesn't match." };
  }

  try {
    await deleteAdminAccountAndAssets(adminId);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to delete account." };
  }
}

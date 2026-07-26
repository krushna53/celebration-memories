"use server";

import { revalidatePath } from "next/cache";

import { requireOwner } from "@/services/admin-auth";
import {
  bulkImportInvitees,
  createInvitee,
  deleteInvitee,
  markInviteSent,
  setCheckedIn,
  updateInvitee,
  type InviteeInput,
} from "@/services/admin-invitees";

export type AdminActionResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Every admin Server Action re-checks the `admins` allowlist itself.
 * Server Actions are independently callable HTTP endpoints — relying
 * only on the dashboard layout's redirect would leave these mutations
 * reachable by anyone who guesses the action's endpoint. Invitees is
 * owner-only (agency-managed), so these call requireOwner() rather than
 * just checking that some admin is signed in.
 */

export async function createInviteeAction(
  eventId: string,
  input: InviteeInput,
): Promise<AdminActionResult> {
  try {
    await requireOwner();
    if (!input.name?.trim()) {
      return { success: false, error: "Name is required." };
    }
    await createInvitee(eventId, input);
    revalidatePath("/admin/invitees");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function updateInviteeAction(
  id: string,
  input: InviteeInput,
): Promise<AdminActionResult> {
  try {
    await requireOwner();
    await updateInvitee(id, input);
    revalidatePath("/admin/invitees");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function deleteInviteeAction(id: string): Promise<AdminActionResult> {
  try {
    await requireOwner();
    await deleteInvitee(id);
    revalidatePath("/admin/invitees");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function toggleCheckInAction(
  id: string,
  checkedIn: boolean,
): Promise<AdminActionResult> {
  try {
    await requireOwner();
    await setCheckedIn(id, checkedIn);
    revalidatePath("/admin/checkin");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

/**
 * Records that an admin tapped WhatsApp for this guest. Called right
 * after opening the wa.me link — best-effort tracking, not a delivery
 * receipt. Failures here shouldn't block the guest's WhatsApp tab, so
 * the manager UI opens WhatsApp first and calls this in the background.
 */
export async function markInviteSentAction(id: string): Promise<AdminActionResult> {
  try {
    await requireOwner();
    await markInviteSent(id);
    revalidatePath("/admin/invitees");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function bulkImportInviteesAction(
  eventId: string,
  rows: InviteeInput[],
): Promise<
  { success: true; created: number; skipped: number } | { success: false; error: string }
> {
  try {
    await requireOwner();
    const result = await bulkImportInvitees(eventId, rows);
    revalidatePath("/admin/invitees");
    revalidatePath("/admin");
    return { success: true, ...result };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

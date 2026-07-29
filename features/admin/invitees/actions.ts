"use server";

import { revalidatePath } from "next/cache";

import { requireOwner, requireAdminForEvent } from "@/services/admin-auth";
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
 * reachable by anyone who guesses the action's endpoint. Invitees used
 * to be owner-only; a client host now manages their own event's guest
 * list too, so these call requireAdminForEvent(eventId) — owner-or-
 * matching-client — instead of requireOwner(). Check-In
 * (toggleCheckInAction below) stays owner-only, unaffected by this.
 */

export async function createInviteeAction(
  eventId: string,
  input: InviteeInput,
): Promise<AdminActionResult> {
  try {
    await requireAdminForEvent(eventId);
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
  eventId: string,
  input: InviteeInput,
): Promise<AdminActionResult> {
  try {
    await requireAdminForEvent(eventId);
    await updateInvitee(id, eventId, input);
    revalidatePath("/admin/invitees");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function deleteInviteeAction(id: string, eventId: string): Promise<AdminActionResult> {
  try {
    await requireAdminForEvent(eventId);
    await deleteInvitee(id, eventId);
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
export async function markInviteSentAction(id: string, eventId: string): Promise<AdminActionResult> {
  try {
    await requireAdminForEvent(eventId);
    await markInviteSent(id, eventId);
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
    await requireAdminForEvent(eventId);
    const result = await bulkImportInvitees(eventId, rows);
    revalidatePath("/admin/invitees");
    revalidatePath("/admin");
    return { success: true, ...result };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

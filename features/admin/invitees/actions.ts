"use server";

import { revalidatePath } from "next/cache";

import { getCurrentAdmin } from "@/services/admin-auth";
import {
  bulkImportInvitees,
  createInvitee,
  deleteInvitee,
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
 * reachable by anyone who guesses the action's endpoint.
 */
async function requireAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) throw new Error("Not authorized.");
  return admin;
}

export async function createInviteeAction(
  eventId: string,
  input: InviteeInput,
): Promise<AdminActionResult> {
  try {
    await requireAdmin();
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
    await requireAdmin();
    await updateInvitee(id, input);
    revalidatePath("/admin/invitees");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function deleteInviteeAction(id: string): Promise<AdminActionResult> {
  try {
    await requireAdmin();
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
    await requireAdmin();
    await setCheckedIn(id, checkedIn);
    revalidatePath("/admin/checkin");
    revalidatePath("/admin");
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
    await requireAdmin();
    const result = await bulkImportInvitees(eventId, rows);
    revalidatePath("/admin/invitees");
    revalidatePath("/admin");
    return { success: true, ...result };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

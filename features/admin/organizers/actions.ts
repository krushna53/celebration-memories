"use server";

import { revalidatePath } from "next/cache";

import { requireAdminForEvent } from "@/services/admin-auth";
import {
  addOrganizerWithPassword,
  inviteOrganizerByEmail,
  removeOrganizer,
} from "@/services/organizers";

export type OrganizerActionResult = { success: true } | { success: false; error: string };

/**
 * Managing organizers is itself an owner/client-only action (not
 * available to an organizer themselves) — requireAdminForEvent already
 * rejects both "session_organizer" and "organizer" outright, which is
 * exactly the gate wanted here, same shape as
 * features/admin/session-organizers/actions.ts.
 */
export async function inviteOrganizerAction(
  eventId: string,
  name: string,
  email: string,
): Promise<OrganizerActionResult> {
  try {
    await requireAdminForEvent(eventId);
    await inviteOrganizerByEmail({ eventId, name, email });
    revalidatePath("/admin/organizers");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to send invite." };
  }
}

export async function addOrganizerWithPasswordAction(
  eventId: string,
  name: string,
  email: string,
  password: string,
): Promise<OrganizerActionResult> {
  try {
    await requireAdminForEvent(eventId);
    await addOrganizerWithPassword({ eventId, name, email, password });
    revalidatePath("/admin/organizers");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to add organizer." };
  }
}

export async function removeOrganizerAction(eventId: string, adminId: string): Promise<OrganizerActionResult> {
  try {
    await requireAdminForEvent(eventId);
    await removeOrganizer(eventId, adminId);
    revalidatePath("/admin/organizers");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to remove organizer." };
  }
}

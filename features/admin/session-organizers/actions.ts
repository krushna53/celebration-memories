"use server";

import { revalidatePath } from "next/cache";

import { requireAdminForEvent } from "@/services/admin-auth";
import {
  addSessionOrganizerWithPassword,
  inviteSessionOrganizerByEmail,
  removeSessionOrganizer,
} from "@/services/session-organizers";

export type SessionOrganizerActionResult = { success: true } | { success: false; error: string };

/** Available to the owner (any event) or the client who owns this event — same guard shape as features/admin/team/actions.ts. */
export async function inviteSessionOrganizerAction(
  eventId: string,
  name: string,
  email: string,
  scheduleItemIds: string[],
): Promise<SessionOrganizerActionResult> {
  try {
    await requireAdminForEvent(eventId);
    await inviteSessionOrganizerByEmail({ eventId, name, email, scheduleItemIds });
    revalidatePath("/admin/session-organizers");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to send invite." };
  }
}

export async function addSessionOrganizerWithPasswordAction(
  eventId: string,
  name: string,
  email: string,
  password: string,
  scheduleItemIds: string[],
): Promise<SessionOrganizerActionResult> {
  try {
    await requireAdminForEvent(eventId);
    await addSessionOrganizerWithPassword({ eventId, name, email, password, scheduleItemIds });
    revalidatePath("/admin/session-organizers");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to add session organizer." };
  }
}

export async function removeSessionOrganizerAction(eventId: string, adminId: string): Promise<SessionOrganizerActionResult> {
  try {
    await requireAdminForEvent(eventId);
    await removeSessionOrganizer(eventId, adminId);
    revalidatePath("/admin/session-organizers");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to remove session organizer." };
  }
}

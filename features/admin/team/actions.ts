"use server";

import { revalidatePath } from "next/cache";

import { requireAdminForEvent } from "@/services/admin-auth";
import {
  addTeamMemberWithPassword,
  inviteTeamMemberByEmail,
  removeTeamMember,
} from "@/services/admin-team";

export type TeamActionResult = { success: true } | { success: false; error: string };

/**
 * Available to the owner (any event) or the client who owns this
 * event (requireAdminForEvent enforces both) — this is the whole point
 * of the feature: a client no longer needs the owner to add someone
 * else to their own event's dashboard.
 */
export async function inviteTeamMemberAction(eventId: string, name: string, email: string): Promise<TeamActionResult> {
  try {
    await requireAdminForEvent(eventId);
    await inviteTeamMemberByEmail({ eventId, name, email });
    revalidatePath("/admin/team");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to send invite." };
  }
}

export async function addTeamMemberWithPasswordAction(
  eventId: string,
  name: string,
  email: string,
  password: string,
): Promise<TeamActionResult> {
  try {
    await requireAdminForEvent(eventId);
    await addTeamMemberWithPassword({ eventId, name, email, password });
    revalidatePath("/admin/team");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to add team member." };
  }
}

export async function removeTeamMemberAction(eventId: string, adminId: string): Promise<TeamActionResult> {
  try {
    const admin = await requireAdminForEvent(eventId);
    if (adminId === admin.id) {
      return { success: false, error: "You can't remove your own access here — ask another team member, or the site owner." };
    }
    await removeTeamMember(eventId, adminId);
    revalidatePath("/admin/team");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to remove team member." };
  }
}

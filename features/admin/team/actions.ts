"use server";

import { revalidatePath } from "next/cache";

import { getCurrentAdmin, requireAdminForEvent } from "@/services/admin-auth";
import {
  addTeamMemberWithPassword,
  inviteTeamMemberByEmail,
  removeTeamMember,
  getTeamMembers,
  type TeamMember,
} from "@/services/admin-team";

import { getEventAccess } from "@/services/event-access";
import { getEventById } from "@/services/events";
import { sendTeamAccessGrantedNotification } from "@/lib/email";
import { SITE_URL } from "@/lib/constants";
import type { CurrentAdmin } from "@/services/admin-auth";
async function requireTeamProvisioning(eventId: string) {
  const admin = await getCurrentAdmin();
  if (admin?.role === "owner") {
    const event = await getEventAccess(eventId);
    if (!event || event.owner_user_id) throw new Error("Only the customer owner can change this event's team.");
    return admin;
  }
  return requireAdminForEvent(eventId);
}
export type TeamActionResult =
  | { success: true; member?: TeamMember; existingAccount?: boolean }
  | { success: false; error: string };

/** Lets an existing login know they can now open this event — never blocks the add if email isn't configured or fails. */
async function notifyExistingAccount(eventId: string, member: TeamMember | undefined, addedBy: CurrentAdmin) {
  if (!member) return;
  try {
    const event = await getEventById(eventId);
    await sendTeamAccessGrantedNotification({
      to: member.email,
      name: member.name || member.email,
      eventName: event?.eventTitle || event?.honoreeName || "an event",
      addedBy: addedBy.name || addedBy.email || "Someone on the team",
      dashboardUrl: `${SITE_URL}/admin`,
    });
  } catch (err) {
    console.error("notifyExistingAccount failed:", err);
  }
}

/**
 * Available to the owner (any event) or the client who owns this
 * event (requireAdminForEvent enforces both) — this is the whole point
 * of the feature: a client no longer needs the owner to add someone
 * else to their own event's dashboard.
 */
export async function inviteTeamMemberAction(
  eventId: string,
  name: string,
  email: string,
  makeEventOwner = false,
): Promise<TeamActionResult> {
  try {
    const admin = await requireTeamProvisioning(eventId);
    // Anyone managing the event may add an existing login; only the platform owner may make it their primary event.
    const { existingAccount } = await inviteTeamMemberByEmail({
      eventId,
      name,
      email,
      canAddExistingAccounts: true,
      canMakeEventOwner: admin.role === "owner",
      makeEventOwner,
    });
    revalidatePath("/admin/team");
    revalidatePath("/admin/events");
    const member = (await getTeamMembers(eventId)).find((item) => item.email.toLowerCase() === email.trim().toLowerCase());
    if (existingAccount) await notifyExistingAccount(eventId, member, admin);
    return { success: true, member, existingAccount };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to send invite." };
  }
}

export async function addTeamMemberWithPasswordAction(
  eventId: string,
  name: string,
  email: string,
  password: string,
  makeEventOwner = false,
): Promise<TeamActionResult> {
  try {
    const admin = await requireTeamProvisioning(eventId);
    const { existingAccount } = await addTeamMemberWithPassword({
      eventId,
      name,
      email,
      password,
      canAddExistingAccounts: true,
      canMakeEventOwner: admin.role === "owner",
      makeEventOwner,
    });
    revalidatePath("/admin/team");
    revalidatePath("/admin/events");
    const member = (await getTeamMembers(eventId)).find((item) => item.email.toLowerCase() === email.trim().toLowerCase());
    if (existingAccount) await notifyExistingAccount(eventId, member, admin);
    return { success: true, member, existingAccount };
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
    revalidatePath("/admin/events");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to remove team member." };
  }
}

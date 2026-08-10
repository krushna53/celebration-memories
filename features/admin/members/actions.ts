"use server";

import { revalidatePath } from "next/cache";

import { requireOwner } from "@/services/admin-auth";
import { deleteAdminAccess, getAdminEmailById } from "@/services/admin-users";
import { deleteAdminAccountAndAssets } from "@/services/admin-danger-zone";
import { addTeamMemberWithPassword, inviteTeamMemberByEmail } from "@/services/admin-team";

export type RemoveAdminResult = { success: true } | { success: false; error: string };

export type AddMemberResult = { success: true } | { success: false; error: string };

/**
 * Owner-only — lets the owner add a new "client" (full-access) member to
 * ANY event directly from /admin/members, rather than having to visit
 * that event's row on /admin/events first. Reuses the exact same
 * services/admin-team.ts functions (and TEAM_MEMBER_CAP-of-4-per-event
 * enforcement) that a client uses to invite their own teammates from
 * /admin/team — the only difference is the owner picks which event here,
 * since /admin/team always operates on "whichever event is currently
 * active" and this page isn't scoped to one event at all.
 */
export async function addMemberByInviteAction(
  eventId: string,
  name: string,
  email: string,
): Promise<AddMemberResult> {
  await requireOwner();
  try {
    await inviteTeamMemberByEmail({ eventId, name, email });
    revalidatePath("/admin/members");
    revalidatePath("/admin/events");
    revalidatePath("/admin/team");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to send invite." };
  }
}

/** Same as addMemberByInviteAction, but the owner sets the password directly instead of emailing an invite link. */
export async function addMemberWithPasswordAction(
  eventId: string,
  name: string,
  email: string,
  password: string,
): Promise<AddMemberResult> {
  await requireOwner();
  try {
    await addTeamMemberWithPassword({ eventId, name, email, password });
    revalidatePath("/admin/members");
    revalidatePath("/admin/events");
    revalidatePath("/admin/team");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to add member." };
  }
}

/**
 * Owner-only — revokes a client admin's dashboard access (see
 * deleteAdminAccess's doc comment for what this does and doesn't do).
 * Refuses to remove the caller's own account (services/admin-users.ts's
 * deleteAdminAccess already restricts this to role='client' rows, so an
 * owner account can never be removed this way at all — this extra
 * check is just for the edge case of one owner account somehow being
 * mis-tagged, and reads clearly on its own either way).
 */
export async function removeAdminAccessAction(id: string): Promise<RemoveAdminResult> {
  const admin = await requireOwner();
  if (id === admin.id) {
    return { success: false, error: "You can't remove your own access." };
  }

  try {
    await deleteAdminAccess(id);
    revalidatePath("/admin/members");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to remove access." };
  }
}

export type DeleteAdminAccountResult = { success: true } | { success: false; error: string };

/**
 * Owner-only — permanently deletes a client account: their login, and
 * their event with everything in it (photos, videos, audio, guestbook,
 * invitees, RSVPs — all of it, see deleteAdminAccountAndAssets). Far
 * more destructive than removeAdminAccessAction above, so this requires
 * the caller to pass back the account's own email as a confirmation —
 * checked server-side against the real value, never trusting whatever
 * the client claims was typed into the confirm box.
 */
export async function deleteAdminAccountAction(
  id: string,
  confirmEmail: string,
): Promise<DeleteAdminAccountResult> {
  const admin = await requireOwner();
  if (id === admin.id) {
    return { success: false, error: "You can't delete your own account." };
  }

  try {
    const actualEmail = await getAdminEmailById(id);
    if (!actualEmail) {
      return { success: false, error: "Account not found." };
    }
    if (actualEmail.trim().toLowerCase() !== confirmEmail.trim().toLowerCase()) {
      return { success: false, error: "That email doesn't match — nothing was deleted." };
    }

    await deleteAdminAccountAndAssets(id);
    revalidatePath("/admin/members");
    revalidatePath("/admin/events");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to delete account." };
  }
}

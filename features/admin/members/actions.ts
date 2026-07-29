"use server";

import { revalidatePath } from "next/cache";

import { requireOwner } from "@/services/admin-auth";
import { deleteAdminAccess } from "@/services/admin-users";

export type RemoveAdminResult = { success: true } | { success: false; error: string };

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

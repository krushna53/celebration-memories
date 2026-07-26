"use server";

import { getCurrentAdmin } from "@/services/admin-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Called once the tour is dismissed (finished or skipped) so it stops
 * auto-playing on future logins. Replaying it later via "Take the
 * Tour" is a purely client-side state toggle and never calls this —
 * only the *first* auto-played run marks it seen.
 */
export async function markTourSeenAction(): Promise<void> {
  const admin = await getCurrentAdmin();
  if (!admin) return;

  const { error } = await supabaseAdmin()
    .from("admins")
    .update({ has_seen_tour: true })
    .eq("id", admin.id);

  if (error) {
    console.error("markTourSeenAction failed:", error.message);
  }
}

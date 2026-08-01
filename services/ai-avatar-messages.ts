import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Cost guard for the guest-facing AI Avatar chat (see lib/ai-avatar-chat.ts):
 * unlike the admin-only AI Image/AI CSS tools, this is reachable by any
 * anonymous visitor, so the cap is a rolling daily count rather than an
 * all-time one — bounds worst-case spend per day indefinitely, instead
 * of an all-time cap that would eventually lock a legitimately popular
 * event out forever.
 */

/** Messages answered for this event since the start of today (UTC). */
export async function countTodayAvatarMessages(eventId: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const { count, error } = await supabaseAdmin()
    .from("ai_avatar_messages")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .gte("created_at", startOfDay.toISOString());

  if (error) {
    console.error("countTodayAvatarMessages failed:", error.message);
    return 0;
  }
  return count ?? 0;
}

export async function recordAvatarMessage(eventId: string): Promise<void> {
  const { error } = await supabaseAdmin().from("ai_avatar_messages").insert({ event_id: eventId });
  if (error) {
    console.error("recordAvatarMessage failed:", error.message);
  }
}

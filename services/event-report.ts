import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Extra figures for the printable event report (app/admin/report) that
 * the dashboard Overview doesn't need — kept separate from
 * services/admin-stats.ts so the Overview's queries stay unchanged.
 */

/** First-time invite opens per calendar day in the event's timezone, oldest first. */
export async function getFirstOpensByDay(eventId: string, timezone: string): Promise<{ day: string; count: number }[]> {
  const { data, error } = await supabaseAdmin()
    .from("invitees")
    .select("opened_at")
    .eq("event_id", eventId)
    .not("opened_at", "is", null);
  if (error || !data) return [];

  const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" });
  const counts = new Map<string, number>();
  for (const row of data as { opened_at: string }[]) {
    const key = dayKey.format(new Date(row.opened_at));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, count]) => ({ day, count }));
}

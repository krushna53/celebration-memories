import "server-only";

import { cache } from "react";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * The events row a public event page already loaded (getEventBySlug with
 * `remember`), kept for the rest of that page render. React's cache is one
 * Map per request, so nothing outlives the render that loaded it.
 */
const rememberedRows = cache(() => new Map<string, object>());

export function rememberEventRow(row: { id: string }): void {
  rememberedRows().set(row.id, row);}

/**
 * Some columns of one event, in the same `{ data, error }` shape as a
 * Supabase `.maybeSingle()`. On an event page the many per-column helpers
 * (WhatsApp contact, RSVP form, co-brand, payment details…) pick them from
 * the remembered row instead of each making its own round trip to the
 * database; everywhere else (admin pages, saves) it is the plain query.
 */
export async function selectEventColumns<T>(eventId: string, columns: string): Promise<{ data: T | null; error: unknown }> {
  const row = rememberedRows().get(eventId);  if (row) return { data: row as T, error: null };
  const { data, error } = await supabaseAdmin().from("events").select(columns).eq("id", eventId).maybeSingle<T>();
  return { data, error };
}

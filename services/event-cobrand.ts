import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * "Powered by <agency>" co-branding for an event (events.cobrand_name /
 * cobrand_url, migration 20261012120000_event_cobranding.sql).
 *
 * Kept out of EventRecord on purpose: it's read only where it's shown,
 * and every read degrades to `null` if the columns don't exist yet, so
 * this code is safe to deploy before the migration runs.
 */
export interface EventCobrand {
  name: string;
  url: string | null;
}

export const COBRAND_NAME_MAX = 60;
export const COBRAND_URL_MAX = 200;

export async function getEventCobrand(eventId: string): Promise<EventCobrand | null> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("events")
      .select("cobrand_name, cobrand_url")
      .eq("id", eventId)
      .maybeSingle<{ cobrand_name: string | null; cobrand_url: string | null }>();
    if (error || !data?.cobrand_name) return null;
    return { name: data.cobrand_name, url: data.cobrand_url };
  } catch {
    return null;
  }
}

/** Trims and validates; returns the row patch or an error message for the host. */
export function parseCobrandInput(
  name: string,
  url: string,
): { ok: true; patch: { cobrand_name: string | null; cobrand_url: string | null } } | { ok: false; error: string } {
  const cleanName = name.trim().replace(/\s+/g, " ");
  const cleanUrl = url.trim();
  if (cleanName.length > COBRAND_NAME_MAX) return { ok: false, error: `Keep the name under ${COBRAND_NAME_MAX} characters.` };
  if (cleanUrl) {
    if (cleanUrl.length > COBRAND_URL_MAX) return { ok: false, error: "That link is too long." };
    let parsed: URL;
    try {
      parsed = new URL(cleanUrl);
    } catch {
      return { ok: false, error: "Enter a full link starting with https://" };
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return { ok: false, error: "Enter a full link starting with https://" };
    }
  }
  if (!cleanName && cleanUrl) return { ok: false, error: "Add the name to show with the link." };
  return { ok: true, patch: { cobrand_name: cleanName || null, cobrand_url: cleanName && cleanUrl ? cleanUrl : null } };
}

export async function saveEventCobrand(
  eventId: string,
  patch: { cobrand_name: string | null; cobrand_url: string | null },
): Promise<void> {
  const { error } = await supabaseAdmin().from("events").update(patch).eq("id", eventId);
  if (error) {
    if (/cobrand_/.test(error.message)) {
      throw new Error("Co-branding isn't switched on for this site yet — the database update still needs to be applied.");
    }
    throw new Error(error.message);
  }
}

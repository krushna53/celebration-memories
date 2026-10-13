import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { DEFAULT_RSVP_CONFIG, isDefaultRsvpConfig, sanitizeRsvpConfig, type RsvpConfig } from "@/lib/rsvp-config";

/**
 * Per-event RSVP form setup (events.rsvp_config — lib/rsvp-config.ts for
 * the shape). Missing/unreadable config = the default form, so a lookup
 * failure can never break RSVPs.
 */
export async function getRsvpConfig(eventId: string): Promise<RsvpConfig> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("events")
      .select("rsvp_config")
      .eq("id", eventId)
      .maybeSingle<{ rsvp_config: unknown }>();
    if (error || !data?.rsvp_config) return DEFAULT_RSVP_CONFIG;
    return sanitizeRsvpConfig(data.rsvp_config);
  } catch {
    return DEFAULT_RSVP_CONFIG;
  }
}

/** Stores the config (null when it's just the default, so the event keeps tracking future default changes). */
export async function saveRsvpConfig(eventId: string, input: unknown): Promise<RsvpConfig> {
  const config = sanitizeRsvpConfig(input);
  const { error } = await supabaseAdmin()
    .from("events")
    .update({ rsvp_config: isDefaultRsvpConfig(config) ? null : config })
    .eq("id", eventId);
  if (error) throw new Error(error.message);
  return config;
}

export interface RsvpAnswerRow {
  name: string;
  coming: string;
  submittedAt: string;
  answers: Record<string, string>;
}

/** Every RSVP for the event that answered at least one custom question, newest first. */
export async function listRsvpAnswers(eventId: string): Promise<RsvpAnswerRow[]> {
  const { data, error } = await supabaseAdmin()
    .from("invitees")
    .select("name, rsvps(coming, answers, submitted_at)")
    .eq("event_id", eventId);
  if (error || !data) return [];
  const rows: RsvpAnswerRow[] = [];
  for (const invitee of data as { name: string; rsvps: { coming: string; answers: Record<string, string> | null; submitted_at: string }[] | { coming: string; answers: Record<string, string> | null; submitted_at: string } | null }[]) {
    const list = Array.isArray(invitee.rsvps) ? invitee.rsvps : invitee.rsvps ? [invitee.rsvps] : [];
    for (const r of list) {
      if (r.answers && Object.keys(r.answers).length > 0) {
        rows.push({ name: invitee.name, coming: r.coming, submittedAt: r.submitted_at, answers: r.answers });
      }
    }
  }
  return rows.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

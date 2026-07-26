import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { parseUserAgent } from "@/lib/user-agent";

export interface TrackingMeta {
  userAgent: string | null;
  referral: string | null;
}

/**
 * Records an invitation "open" event: bumps opened_at / last_opened_at /
 * visit_count on the invitee (atomically, via the `record_invite_visit`
 * DB function) and appends a row to activity_logs with coarse
 * device/browser/OS info.
 *
 * Per CLAUDE.md → Invitation Tracking: this never attempts to identify
 * individual WhatsApp users — only the invite token, plus standard
 * request metadata (user agent, referrer), is recorded.
 */
export async function logInviteOpened(inviteeId: string, meta: TrackingMeta) {
  const client = supabaseAdmin();
  const { device, browser, operatingSystem } = parseUserAgent(meta.userAgent);

  const [{ error: rpcError }, { error: logError }] = await Promise.all([
    client.rpc("record_invite_visit", { p_invitee_id: inviteeId }),
    client.from("activity_logs").insert({
      invitee_id: inviteeId,
      event_type: "invite_opened",
      device,
      browser,
      operating_system: operatingSystem,
      referral: meta.referral,
    }),
  ]);

  if (rpcError) {
    console.error("record_invite_visit failed:", rpcError.message);
  }
  if (logError) {
    console.error("activity_logs insert failed:", logError.message);
  }
}

/** Logs a non-tracking activity event, e.g. an RSVP submission. */
export async function logActivity(inviteeId: string, eventType: string) {
  const { error } = await supabaseAdmin().from("activity_logs").insert({
    invitee_id: inviteeId,
    event_type: eventType,
  });

  if (error) {
    console.error(`activity_logs insert (${eventType}) failed:`, error.message);
  }
}

export type PageViewType = "landing" | "public_rsvp";

/**
 * Logs an anonymous page view (no invitee identity yet) — the homepage/
 * event landing page, or the public RSVP page. Fired client-side via a
 * PageViewBeacon (features/analytics/page-view-beacon.tsx) rather than
 * during a cached/ISR page render, so it's counted per real visit
 * rather than per revalidation window.
 */
export async function logPageView(eventId: string, page: PageViewType): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("activity_logs")
    .insert({ event_id: eventId, event_type: `page_view_${page}` });

  if (error) {
    console.error(`activity_logs page_view_${page} insert failed:`, error.message);
  }
}

export type RsvpFormSource = "token" | "public";

/**
 * Logs "a visitor engaged with the RSVP form" (fired on first field
 * focus, not just page load — see the forms' onFocus handlers) so the
 * admin Visitor Funnel can show landing views → started RSVP →
 * submitted RSVP, a rough proxy for where guests are dropping off.
 */
export async function logRsvpStarted(eventId: string, source: RsvpFormSource): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("activity_logs")
    .insert({ event_id: eventId, event_type: `rsvp_form_started_${source}` });

  if (error) {
    console.error(`activity_logs rsvp_form_started_${source} insert failed:`, error.message);
  }
}

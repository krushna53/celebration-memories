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

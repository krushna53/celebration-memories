// Guest reminder system — sends one Web Push notification per invitee
// who started recording/uploading a video or audio memory but never
// finished. Runs two ways:
//   * Manually — the admin dashboard POSTs { eventId } to trigger an
//     immediate send for just that event (see features/admin/
//     event-settings's "Send reminders now" button).
//   * Automatically — pg_cron calls this with no body on a schedule
//     (see migration 0024_guest_reminder_cron.sql), processing every
//     event with guest_reminder_enabled = true.
//
// "Abandoned" is derived entirely from the existing activity_logs event
// log (no separate attempts table — see 0023_guest_reminder_push.sql's
// header comment): an invitee's most recent
// `${kind}_capture_started` event (kind: video | audio) is older than
// the event's guest_reminder_delay_minutes, with no `${kind}_uploaded`
// event after it, and no `reminder_sent_${kind}` event after it (so the
// same abandoned attempt is only ever reminded once).
//
// Same boilerplate shape as the other functions in this directory
// (corsHeaders, jsonResponse, Deno.serve) — see video-edit-status/
// index.ts for the fuller convention writeup.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

interface RequestBody {
  eventId?: string;
}

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const REMINDER_KINDS = ["video", "audio"] as const;
type ReminderKind = (typeof REMINDER_KINDS)[number];

interface ActivityRow {
  invitee_id: string;
  event_type: string;
  created_at: string;
}

interface SubscriptionRow {
  id: string;
  invitee_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const vapidPublicKey = Deno.env.get("NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT");

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("send-reminder-push: missing Supabase env vars");
    return jsonResponse({ success: false, error: "Not configured" }, 500);
  }
  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    // Not an error — Web Push is an optional integration (see
    // lib/push.ts). A cron run with nothing configured should just be a
    // silent no-op, not a repeating error in the logs.
    return jsonResponse({ success: true, sent: 0, note: "Web Push not configured" }, 200);
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  let body: RequestBody = {};
  try {
    if (req.headers.get("content-length") !== "0") {
      const text = await req.text();
      if (text) body = JSON.parse(text);
    }
  } catch {
    return jsonResponse({ success: false, error: "Invalid request body" }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let eventIds: string[];
  if (body.eventId) {
    eventIds = [body.eventId];
  } else {
    const { data, error } = await supabase.from("events").select("id").eq("guest_reminder_enabled", true);
    if (error) {
      console.error("send-reminder-push: failed to list events:", error.message);
      return jsonResponse({ success: false, error: "Failed to list events" }, 500);
    }
    eventIds = (data ?? []).map((row: { id: string }) => row.id);
  }

  let totalSent = 0;
  let totalConsidered = 0;
  const errors: string[] = [];

  for (const eventId of eventIds) {
    const { data: eventRow, error: eventError } = await supabase
      .from("events")
      .select("id, guest_reminder_enabled, guest_reminder_delay_minutes")
      .eq("id", eventId)
      .maybeSingle<{ id: string; guest_reminder_enabled: boolean; guest_reminder_delay_minutes: number }>();

    if (eventError || !eventRow) {
      errors.push(`event ${eventId}: not found`);
      continue;
    }
    // A manual trigger (body.eventId set) is allowed to bypass the
    // enabled flag — the admin explicitly asked for a send right now —
    // but an automatic cron pass must still respect it.
    if (!body.eventId && !eventRow.guest_reminder_enabled) continue;

    const delayMs = Math.max(1, eventRow.guest_reminder_delay_minutes) * 60_000;
    const cutoff = new Date(Date.now() - delayMs).toISOString();

    const { data: invitees, error: inviteesError } = await supabase
      .from("invitees")
      .select("id")
      .eq("event_id", eventId);

    if (inviteesError || !invitees?.length) continue;
    const inviteeIds = invitees.map((i: { id: string }) => i.id);

    const relevantTypes = REMINDER_KINDS.flatMap((k) => [`${k}_capture_started`, `${k}_uploaded`, `reminder_sent_${k}`]);

    const { data: activity, error: activityError } = await supabase
      .from("activity_logs")
      .select("invitee_id, event_type, created_at")
      .in("invitee_id", inviteeIds)
      .in("event_type", relevantTypes)
      .order("created_at", { ascending: true });

    if (activityError) {
      errors.push(`event ${eventId}: activity query failed (${activityError.message})`);
      continue;
    }

    // Latest timestamp per (invitee, kind, phase) — a plain object walk
    // keeps this readable at this app's scale (family/event guest lists,
    // not millions of rows) rather than reaching for a SQL window
    // function inside an Edge Function.
    const latest = new Map<string, string>(); // key: `${inviteeId}:${eventType}` -> ISO timestamp
    for (const row of (activity ?? []) as ActivityRow[]) {
      latest.set(`${row.invitee_id}:${row.event_type}`, row.created_at);
    }

    const dueByInvitee = new Map<string, ReminderKind[]>();
    for (const inviteeId of inviteeIds) {
      for (const kind of REMINDER_KINDS) {
        const started = latest.get(`${inviteeId}:${kind}_capture_started`);
        if (!started) continue;
        if (started > cutoff) continue; // not old enough yet

        const uploaded = latest.get(`${inviteeId}:${kind}_uploaded`);
        if (uploaded && uploaded > started) continue; // finished after they started — not abandoned

        const reminded = latest.get(`${inviteeId}:reminder_sent_${kind}`);
        if (reminded && reminded > started) continue; // already reminded for this attempt

        totalConsidered++;
        const list = dueByInvitee.get(inviteeId) ?? [];
        list.push(kind);
        dueByInvitee.set(inviteeId, list);
      }
    }

    if (dueByInvitee.size === 0) continue;

    const { data: subscriptions, error: subsError } = await supabase
      .from("push_subscriptions")
      .select("id, invitee_id, endpoint, p256dh, auth")
      .in("invitee_id", Array.from(dueByInvitee.keys()));

    if (subsError) {
      errors.push(`event ${eventId}: subscriptions query failed (${subsError.message})`);
      continue;
    }

    const subsByInvitee = new Map<string, SubscriptionRow[]>();
    for (const sub of (subscriptions ?? []) as SubscriptionRow[]) {
      const list = subsByInvitee.get(sub.invitee_id) ?? [];
      list.push(sub);
      subsByInvitee.set(sub.invitee_id, list);
    }

    for (const [inviteeId, kinds] of dueByInvitee.entries()) {
      const subs = subsByInvitee.get(inviteeId);
      if (!subs?.length) continue; // no device subscribed — nothing to send

      // One combined notification even if both video and audio are
      // pending, so a guest never gets double-pinged in the same run.
      const label = kinds.length > 1 ? "video and audio" : kinds[0];
      const payload = JSON.stringify({
        title: "Don't forget your memory!",
        body: `You started a ${label} message but haven't uploaded it yet. Tap to finish.`,
        url: "/",
        tag: "guest-reminder",
      });

      let sentToAnyDevice = false;
      for (const sub of subs) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          );
          sentToAnyDevice = true;
          totalSent++;
        } catch (err) {
          const statusCode = (err as { statusCode?: number })?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            // Subscription is dead (browser unsubscribed, storage
            // cleared, etc.) — remove it so future runs stop retrying.
            await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          } else {
            const message = err instanceof Error ? err.message : "Unknown error";
            errors.push(`invitee ${inviteeId}: push send failed (${message})`);
          }
        }
      }

      if (sentToAnyDevice) {
        for (const kind of kinds) {
          await supabase.from("activity_logs").insert({ invitee_id: inviteeId, event_type: `reminder_sent_${kind}` });
        }
      }
    }
  }

  return jsonResponse({ success: true, sent: totalSent, considered: totalConsidered, errors }, 200);
});

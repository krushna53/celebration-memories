// Guest reminder system, second reminder type: a one-time nudge to
// guests who RSVP'd "coming" or "maybe" but haven't shared any memory
// (photo/video/audio/guestbook message) yet, encouraging them to
// before the event. Distinct from send-reminder-push (which targets a
// specific abandoned recording/upload) — this targets engaged,
// confirmed guests generally, on a days-before-the-event schedule
// rather than a per-attempt delay.
//
// Runs two ways, same split as send-reminder-push:
//   * Manually — admin POSTs { eventId } from Event Settings' "Send
//     memory-nudge now" button — bypasses both
//     share_memory_nudge_enabled and the days-before window.
//   * Automatically — pg_cron calls with no body once daily, processing
//     every event with share_memory_nudge_enabled = true whose start_at
//     is within share_memory_nudge_days_before days from now.
//
// Sent at most once ever per invitee (a `memory_nudge_sent` activity_logs
// row marks it done), regardless of how many days the cron job keeps
// finding them still eligible.

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
    console.error("send-memory-nudge-push: missing Supabase env vars");
    return jsonResponse({ success: false, error: "Not configured" }, 500);
  }
  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
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
    const { data, error } = await supabase.from("events").select("id").eq("share_memory_nudge_enabled", true);
    if (error) {
      console.error("send-memory-nudge-push: failed to list events:", error.message);
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
      .select("id, start_at, share_memory_nudge_enabled, share_memory_nudge_days_before")
      .eq("id", eventId)
      .maybeSingle<{
        id: string;
        start_at: string;
        share_memory_nudge_enabled: boolean;
        share_memory_nudge_days_before: number;
      }>();

    if (eventError || !eventRow) {
      errors.push(`event ${eventId}: not found`);
      continue;
    }
    if (!body.eventId) {
      if (!eventRow.share_memory_nudge_enabled) continue;
      const daysUntil = (new Date(eventRow.start_at).getTime() - Date.now()) / 86_400_000;
      // Only within the configured window, and not for an event that
      // already happened — no point nudging guests about a memory wall
      // for a past event.
      if (daysUntil < 0 || daysUntil > eventRow.share_memory_nudge_days_before) continue;
    }

    const { data: invitees, error: inviteesError } = await supabase
      .from("invitees")
      .select("id, rsvp_status")
      .eq("event_id", eventId)
      .in("rsvp_status", ["coming", "maybe"]);

    if (inviteesError || !invitees?.length) continue;
    const inviteeIds = invitees.map((i: { id: string }) => i.id);

    // Exclude anyone who's already shared something (photo/video/audio/
    // guestbook message) — this is a "you haven't shared yet" nudge,
    // not a generic reminder.
    const [{ data: photoRows }, { data: videoRows }, { data: audioRows }, { data: guestbookRows }] = await Promise.all(
      [
        supabase.from("photos").select("invitee_id").in("invitee_id", inviteeIds),
        supabase.from("videos").select("invitee_id").in("invitee_id", inviteeIds),
        supabase.from("audio").select("invitee_id").in("invitee_id", inviteeIds),
        supabase.from("guestbook").select("invitee_id").in("invitee_id", inviteeIds),
      ],
    );
    const alreadyShared = new Set<string>();
    for (const rows of [photoRows, videoRows, audioRows, guestbookRows]) {
      for (const row of (rows ?? []) as { invitee_id: string | null }[]) {
        if (row.invitee_id) alreadyShared.add(row.invitee_id);
      }
    }

    // Exclude anyone already nudged (ever) — a plain existence check via
    // activity_logs, same event-log-reuse pattern as send-reminder-push.
    const { data: nudgedRows } = await supabase
      .from("activity_logs")
      .select("invitee_id")
      .in("invitee_id", inviteeIds)
      .eq("event_type", "memory_nudge_sent");
    const alreadyNudged = new Set((nudgedRows ?? []).map((r: { invitee_id: string | null }) => r.invitee_id));

    const eligibleIds = inviteeIds.filter((id) => !alreadyShared.has(id) && !alreadyNudged.has(id));
    if (eligibleIds.length === 0) continue;
    totalConsidered += eligibleIds.length;

    const { data: subscriptions, error: subsError } = await supabase
      .from("push_subscriptions")
      .select("id, invitee_id, endpoint, p256dh, auth")
      .in("invitee_id", eligibleIds);

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

    const payload = JSON.stringify({
      title: "Share a memory!",
      body: "We can't wait to see you — share a photo or video memory before the big day.",
      url: "/",
      tag: "memory-nudge",
    });

    for (const inviteeId of eligibleIds) {
      const subs = subsByInvitee.get(inviteeId);
      if (!subs?.length) continue; // no device subscribed — nothing to send

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
            await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          } else {
            const message = err instanceof Error ? err.message : "Unknown error";
            errors.push(`invitee ${inviteeId}: push send failed (${message})`);
          }
        }
      }

      if (sentToAnyDevice) {
        await supabase.from("activity_logs").insert({ invitee_id: inviteeId, event_type: "memory_nudge_sent" });
      }
    }
  }

  return jsonResponse({ success: true, sent: totalSent, considered: totalConsidered, errors }, 200);
});

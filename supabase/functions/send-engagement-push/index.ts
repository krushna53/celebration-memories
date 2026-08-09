// Guest reminder system, third type: broadcast "engagement" push
// notifications to every guest who opted in via EngagementOptInBanner
// (shown only when the guest is running the installed PWA — see that
// component's doc comment). Two kinds of broadcast, deliberately
// capped to avoid the guest-facing spam a literal "notify like
// Zomato/Zepto" request would otherwise produce on a one-time event:
//
//   1. Countdown milestones — "7 days to go", "1 day to go", "Today's
//      the day" — sent once each, ever, per event.
//   2. New-content digests — new Gallery photos, or new approved
//      Memory Wall content (photo/video/audio/guestbook) — at most
//      once per ~20 hours, and only if something actually changed
//      since the last digest.
//
// No per-invitee targeting here (unlike send-reminder-push/
// send-memory-nudge-push) — this broadcasts to every push_subscriptions
// row tied to the event, since every opted-in guest should hear about
// these. De-duplication uses a single activity_logs row per event per
// milestone/digest (invitee_id left null, event_id set) — see this
// repo's other reminder functions for the same reuse-the-log pattern.
//
// Runs two ways, same split as the other two reminder Edge Functions:
//   * Manually — { eventId } in the body, bypasses
//     engagement_notifications_enabled.
//   * Automatically — pg_cron, no body, once daily, processing every
//     event with engagement_notifications_enabled = true.

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
  endpoint: string;
  p256dh: string;
  auth: string;
}

const MILESTONE_DAYS = [7, 1, 0] as const;
const DIGEST_COOLDOWN_HOURS = 20;

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
    console.error("send-engagement-push: missing Supabase env vars");
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
    const { data, error } = await supabase.from("events").select("id").eq("engagement_notifications_enabled", true);
    if (error) {
      console.error("send-engagement-push: failed to list events:", error.message);
      return jsonResponse({ success: false, error: "Failed to list events" }, 500);
    }
    eventIds = (data ?? []).map((row: { id: string }) => row.id);
  }

  let totalSent = 0;
  const broadcasts: string[] = [];
  const errors: string[] = [];

  for (const eventId of eventIds) {
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, honoree_name, start_at")
      .eq("id", eventId)
      .maybeSingle<{ id: string; honoree_name: string; start_at: string }>();

    if (eventError || !event) {
      errors.push(`event ${eventId}: not found`);
      continue;
    }

    const { data: subsData, error: subsError } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("event_id", eventId);

    if (subsError) {
      errors.push(`event ${eventId}: subscriptions query failed (${subsError.message})`);
      continue;
    }
    const subs = (subsData ?? []) as SubscriptionRow[];
    if (subs.length === 0) continue; // no opted-in guests — nothing to compute or send

    async function alreadySent(eventType: string): Promise<boolean> {
      const { data } = await supabase
        .from("activity_logs")
        .select("id")
        .eq("event_id", eventId)
        .eq("event_type", eventType)
        .limit(1);
      return (data?.length ?? 0) > 0;
    }

    async function broadcast(title: string, message: string, eventType: string): Promise<void> {
      const payload = JSON.stringify({ title, body: message, url: "/", tag: "engagement" });
      let sentAny = false;
      for (const sub of subs) {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
          sentAny = true;
          totalSent++;
        } catch (err) {
          const statusCode = (err as { statusCode?: number })?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          } else {
            const msg = err instanceof Error ? err.message : "Unknown error";
            errors.push(`event ${eventId}: push send failed (${msg})`);
          }
        }
      }
      if (sentAny) {
        await supabase.from("activity_logs").insert({ event_id: eventId, event_type: eventType });
        broadcasts.push(`${eventId}:${eventType}`);
      }
    }

    // --- Countdown milestones ---------------------------------------
    const daysUntil = Math.ceil((new Date(event.start_at).getTime() - Date.now()) / 86_400_000);
    for (const milestone of MILESTONE_DAYS) {
      const eventType = `countdown_${milestone}d_sent`;
      const matches = milestone === 0 ? daysUntil <= 0 : daysUntil === milestone;
      if (!matches) continue;
      if (await alreadySent(eventType)) continue;

      const title = milestone === 0 ? "Today's the day!" : `${milestone} day${milestone === 1 ? "" : "s"} to go!`;
      const message =
        milestone === 0
          ? `${event.honoree_name}'s celebration is today — see you there!`
          : `Just ${milestone} day${milestone === 1 ? "" : "s"} until ${event.honoree_name}'s celebration.`;
      await broadcast(title, message, eventType);
      break; // at most one countdown push per event per run
    }

    // --- New Gallery photos digest ------------------------------------
    {
      const lastDigestType = "gallery_digest_sent";
      const { data: lastDigest } = await supabase
        .from("activity_logs")
        .select("created_at")
        .eq("event_id", eventId)
        .eq("event_type", lastDigestType)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<{ created_at: string }>();

      const cooledDown =
        !lastDigest || Date.now() - new Date(lastDigest.created_at).getTime() > DIGEST_COOLDOWN_HOURS * 3_600_000;

      if (cooledDown) {
        const sinceIso = lastDigest?.created_at ?? new Date(Date.now() - 24 * 3_600_000).toISOString();
        const { count } = await supabase
          .from("gallery_photos")
          .select("id", { count: "exact", head: true })
          .eq("event_id", eventId)
          .gt("created_at", sinceIso);

        if ((count ?? 0) > 0) {
          await broadcast(
            "New photos added!",
            `New photos were just added to ${event.honoree_name}'s Gallery — take a look.`,
            lastDigestType,
          );
        }
      }
    }

    // --- New Memory Wall content digest -------------------------------
    {
      const lastDigestType = "memory_digest_sent";
      const { data: lastDigest } = await supabase
        .from("activity_logs")
        .select("created_at")
        .eq("event_id", eventId)
        .eq("event_type", lastDigestType)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<{ created_at: string }>();

      const cooledDown =
        !lastDigest || Date.now() - new Date(lastDigest.created_at).getTime() > DIGEST_COOLDOWN_HOURS * 3_600_000;

      if (cooledDown) {
        const sinceIso = lastDigest?.created_at ?? new Date(Date.now() - 24 * 3_600_000).toISOString();
        const counts = await Promise.all(
          (["photos", "videos", "audio", "guestbook"] as const).map((table) =>
            supabase
              .from(table)
              .select("id", { count: "exact", head: true })
              .eq("event_id", eventId)
              .eq("approved", true)
              .gt("created_at", sinceIso)
              .then((r) => r.count ?? 0),
          ),
        );
        const total = counts.reduce((a, b) => a + b, 0);

        if (total > 0) {
          await broadcast(
            "New memories shared!",
            `Guests have shared ${total} new memor${total === 1 ? "y" : "ies"} for ${event.honoree_name}'s celebration.`,
            lastDigestType,
          );
        }
      }
    }
  }

  return jsonResponse({ success: true, sent: totalSent, broadcasts, errors }, 200);
});

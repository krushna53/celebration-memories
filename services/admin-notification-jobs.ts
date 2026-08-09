import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAdminByEventId } from "@/services/admin-auth";
import {
  createAdminNotification,
  hasRecentNotification,
} from "@/services/admin-notifications";
import { FEATURE_NUDGES } from "@/services/admin-feature-nudges";
import { getEventStorageUsage } from "@/services/storage-usage";
import { formatBytes } from "@/lib/format-bytes";

/**
 * Three daily admin-notification producers, called together once a day
 * by app/api/cron/admin-notifications/route.ts (triggered by pg_cron —
 * see migration 0028_admin_notifications_cron.sql). All three are
 * scoped to each event's client-role admin only, not the owner — these
 * are "how's your own event going" nudges, not cross-client platform
 * monitoring (the owner already has /admin/usage and /admin/storage for
 * that). RSVP-submitted notifications (services/admin-notifications.ts's
 * notifyAdminsOfRsvpSubmission) are the one producer that also reaches
 * the owner, fired synchronously from the RSVP action instead of here.
 */

interface ActiveEventRow {
  id: string;
  slug: string;
  honoree_name: string;
  event_title: string;
  end_at: string;
  storage_quota_gb: number;
}

async function listActiveEventsForJobs(): Promise<ActiveEventRow[]> {
  const { data, error } = await supabaseAdmin()
    .from("events")
    .select("id, slug, honoree_name, event_title, end_at, storage_quota_gb")
    .eq("status", "active");

  if (error) {
    console.error("listActiveEventsForJobs failed:", error.message);
    return [];
  }
  return data as ActiveEventRow[];
}

/**
 * Feature-discovery nudges: once a day, for each event that hasn't
 * ended yet, find the client admin's first not-yet-tried, not-yet-
 * nudged feature (registry order — see admin-feature-nudges.ts) and
 * notify them about it. Naturally stops once every feature has either
 * been tried or already nudged once — no re-nudging about the same
 * feature repeatedly.
 */
export async function runFeatureNudgeJob(): Promise<{ sent: number }> {
  const events = await listActiveEventsForJobs();
  const now = new Date();
  let sent = 0;

  for (const event of events) {
    if (new Date(event.end_at) <= now) continue; // event already ended — post-event job takes over

    const admin = await getAdminByEventId(event.id);
    if (!admin) continue;

    // Already nudged today? Don't double-send if the cron somehow runs
    // twice in a day.
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    const alreadyToday = await hasRecentNotification({
      adminId: admin.id,
      type: "feature_nudge",
      sinceIso: startOfToday.toISOString(),
    });
    if (alreadyToday) continue;

    for (const feature of FEATURE_NUDGES) {
      const [used, alreadyNudged] = await Promise.all([
        feature.checkUsed(event.id),
        hasRecentNotification({
          adminId: admin.id,
          type: "feature_nudge",
          sinceIso: "1970-01-01T00:00:00Z", // "ever" — a feature is only nudged once per event, period
          metadataKey: "feature_key",
          metadataValue: feature.key,
        }),
      ]);
      if (used || alreadyNudged) continue;

      await createAdminNotification({
        adminId: admin.id,
        eventId: event.id,
        type: "feature_nudge",
        title: feature.title,
        body: feature.body,
        link: feature.link,
        metadata: { feature_key: feature.key },
      });
      sent++;
      break; // one nudge per admin per day
    }
  }

  return { sent };
}

/**
 * Post-event "new event plans" prompt: once an event's end_at has
 * passed, the client admin switches from feature nudges to a twice-
 * monthly (every 14 days) account-level prompt suggesting they start
 * planning another event. Runs off the same daily cron; the 14-day gate
 * is enforced by checking for a prior new_event_prompt notification
 * within the last 14 days rather than a fixed day-of-month, so it
 * self-schedules regardless of exactly when an event ended.
 */
export async function runNewEventPromptJob(): Promise<{ sent: number }> {
  const events = await listActiveEventsForJobs();
  const now = new Date();
  let sent = 0;
  const notifiedAdmins = new Set<string>(); // an owner-linked admin could theoretically map to >1 ended event; only prompt once per run

  for (const event of events) {
    if (new Date(event.end_at) > now) continue; // still upcoming — feature nudge job handles it

    const admin = await getAdminByEventId(event.id);
    if (!admin || notifiedAdmins.has(admin.id)) continue;

    const fourteenDaysAgo = new Date(now.getTime() - 14 * 86_400_000).toISOString();
    const alreadyPrompted = await hasRecentNotification({
      adminId: admin.id,
      type: "new_event_prompt",
      sinceIso: fourteenDaysAgo,
    });
    if (alreadyPrompted) continue;

    await createAdminNotification({
      adminId: admin.id,
      eventId: null,
      type: "new_event_prompt",
      title: "Planning another event?",
      body: "Your last event has wrapped up — if there's a birthday, wedding, or celebration coming up, you can start a new one anytime.",
      link: "/start",
    });
    notifiedAdmins.add(admin.id);
    sent++;
  }

  return { sent };
}

/**
 * Storage-quota warnings: once a day, for each event, compares live
 * Storage usage (services/storage-usage.ts, the same computation the
 * owner-only /admin/storage dashboard uses) against the event's
 * editable storage_quota_gb. Notifies the client admin once usage
 * crosses 80% of quota, at most once every 7 days (so it doesn't
 * re-fire daily once past the threshold).
 */
export async function runStorageUsageJob(): Promise<{ sent: number }> {
  const events = await listActiveEventsForJobs();
  let sent = 0;
  const WARNING_THRESHOLD = 0.8;

  for (const event of events) {
    const admin = await getAdminByEventId(event.id);
    if (!admin) continue;

    const quotaBytes = event.storage_quota_gb * 1024 * 1024 * 1024;
    if (quotaBytes <= 0) continue;

    const usage = await getEventStorageUsage({
      id: event.id,
      slug: event.slug,
      honoreeName: event.honoree_name,
      eventTitle: event.event_title,
    });

    const ratio = usage.totalBytes / quotaBytes;
    if (ratio < WARNING_THRESHOLD) continue;

    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const alreadyWarned = await hasRecentNotification({
      adminId: admin.id,
      type: "storage_usage",
      sinceIso: sevenDaysAgo,
    });
    if (alreadyWarned) continue;

    const percent = Math.round(ratio * 100);
    await createAdminNotification({
      adminId: admin.id,
      eventId: event.id,
      type: "storage_usage",
      title: percent >= 100 ? "Storage quota reached" : "Storage usage getting high",
      body: `${event.honoree_name}'s event is using ${formatBytes(usage.totalBytes)} of your ${event.storage_quota_gb} GB quota (${percent}%).`,
      // /admin/storage is the owner-only cross-client comparison
      // dashboard (deliberately restricted — see that page's own doc
      // comment) — a client admin's own usage/quota instead lives in
      // Event Settings (see the "Storage" section added there).
      link: "/admin/event-settings",
      metadata: { percent },
    });
    sent++;
  }

  return { sent };
}

export async function runDailyAdminNotificationJobs(): Promise<{
  featureNudges: number;
  newEventPrompts: number;
  storageWarnings: number;
}> {
  const [featureNudges, newEventPrompts, storageWarnings] = await Promise.all([
    runFeatureNudgeJob(),
    runNewEventPromptJob(),
    runStorageUsageJob(),
  ]);
  return {
    featureNudges: featureNudges.sent,
    newEventPrompts: newEventPrompts.sent,
    storageWarnings: storageWarnings.sent,
  };
}

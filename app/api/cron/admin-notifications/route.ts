import { NextResponse } from "next/server";

import { runDailyAdminNotificationJobs } from "@/services/admin-notification-jobs";

/**
 * Daily admin-notification dispatch — pg_cron calls this once a day
 * (see migration 0028_admin_notifications_cron.sql) via pg_net, the
 * same way it triggers the guest-facing Supabase Edge Functions
 * (send-reminder-push, send-memory-nudge-push). This one is a plain
 * Next.js Route Handler instead of a Supabase Edge Function because it
 * reuses existing Next-side services directly — most notably
 * services/storage-usage.ts's getEventStorageUsage, which already runs
 * successfully inside a Next.js Server Component today
 * (/admin/storage) — reimplementing that Storage-listing logic in Deno
 * for an Edge Function would just be duplicated code for no real
 * benefit at this app's current event count/traffic. Revisit if this
 * ever needs a longer wall-clock budget than Netlify's function limit
 * allows (see supabase/README.md's "Why not a Netlify Background
 * Function?" note for the general shape of that tradeoff).
 *
 * Protected by a shared secret (CRON_SECRET) rather than verify_jwt —
 * this is a plain HTTP route, not a Supabase Edge Function, so there's
 * no built-in JWT gate. Anyone with the URL but not the secret gets a
 * 401; nothing here is guest-facing or exposes data in its response
 * beyond a count of notifications sent.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ success: false, error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runDailyAdminNotificationJobs();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("admin-notifications cron failed:", err);
    return NextResponse.json({ success: false, error: "Job failed" }, { status: 500 });
  }
}

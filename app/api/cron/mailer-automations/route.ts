import { NextResponse } from "next/server";

import { configuredBackendName } from "@/services/mailer-email-config/backend";
import { appOrigin } from "@/services/mailer/live-call";
import { runAutomationsForAllTenants } from "@/services/mailer/live-mailer";

/**
 * Event Mailer automations — birthday greetings, HR birthday reminders and
 * work-anniversary emails (lib/mailer/automations.ts), for every company
 * that has one switched on.
 *
 * Call it on a schedule (hourly is fine — e.g. a Netlify Scheduled
 * Function, pg_cron + pg_net, or any external cron service):
 *   POST /api/cron/mailer-automations
 *   Authorization: Bearer <CRON_SECRET>
 * It does nothing before 09:00 India time, and an email that was already
 * sent is never sent again, so extra calls are harmless.
 *
 * Protected by CRON_SECRET like /api/cron/admin-notifications.
 */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ success: false, error: "CRON_SECRET not configured" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (configuredBackendName() !== "firestore") {
    return NextResponse.json({ success: true, ran: false, reason: "Mailer live data needs MAILER_EMAIL_CONFIG_STORE=firestore" });
  }

  try {
    const result = await runAutomationsForAllTenants(await appOrigin());
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("mailer-automations cron failed:", { name: (err as Error)?.name });
    return NextResponse.json({ success: false, error: "Job failed" }, { status: 500 });
  }
}

export const POST = handle;
export const GET = handle;
export const dynamic = "force-dynamic";

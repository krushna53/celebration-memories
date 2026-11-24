import { NextResponse } from "next/server";

import { runWhatsAppAutomations } from "@/services/whatsapp";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * WhatsApp dispatch — pg_cron calls this every 15 minutes (migration
 * 20261124120000_whatsapp_cloud_api.sql) to queue due reminders and
 * post-event messages and drain the outbox (retries included). Same
 * CRON_SECRET bearer gate as app/api/cron/admin-notifications. Does
 * nothing beyond draining when WhatsApp is switched off.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ success: false, error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runWhatsAppAutomations();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("whatsapp cron failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ success: false, error: "Job failed" }, { status: 500 });
  }
}

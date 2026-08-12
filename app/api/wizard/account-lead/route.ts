import { NextResponse } from "next/server";

import { recordWizardAccountLead } from "@/services/wizard-leads";

export const dynamic = "force-dynamic";

/**
 * Plain Route Handler (not a Server Action) for reporting a "left the
 * Create Account page without ever submitting" drop-off from
 * features/start/account-form.tsx, hit via navigator.sendBeacon or
 * fetch(..., { keepalive: true }) on beforeunload/pagehide. A Server
 * Action invocation isn't guaranteed to complete once the browser starts
 * tearing the page down on navigation/tab-close — sendBeacon is the one
 * browser API specifically designed to survive that, and it only works
 * against a plain URL endpoint, not Next's Server Action RPC mechanism.
 *
 * Deliberately tolerant of malformed bodies (sendBeacon can't set
 * Content-Type reliably across browsers) and always returns 204 — this
 * is a best-effort background signal, never something the page should
 * retry or surface an error for.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as {
      eventId?: string | null;
      name?: string | null;
      email?: string | null;
      phone?: string | null;
    };

    await recordWizardAccountLead({
      draftEventId: body.eventId ?? null,
      name: body.name ?? null,
      email: body.email ?? null,
      phone: body.phone ?? null,
      reason: "abandoned",
    });
  } catch (err) {
    console.error("wizard account-lead beacon failed:", err instanceof Error ? err.message : err);
  }

  return new NextResponse(null, { status: 204 });
}

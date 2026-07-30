import "server-only";
import { NextResponse } from "next/server";

import { getInviteeByToken } from "@/services/invitees";
import { submitRsvp } from "@/services/rsvps";
import { logRsvpStarted } from "@/services/tracking";
import { rsvpFormSchema } from "@/types/rsvp";

export const dynamic = "force-dynamic";

/**
 * Public, token-gated RSVP submission for the companion mobile app.
 * Mirrors features/rsvp/actions.ts's server action: re-resolves the
 * invitee from the token server-side (the request body's token is the
 * only thing trusted — an inviteeId is never accepted directly), reuses
 * the exact same rsvpFormSchema + submitRsvp used by the web RSVP form
 * so the two clients can never validate differently.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { token, ...formFields } = (body ?? {}) as { token?: string };
  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Missing invitation token." }, { status: 400 });
  }

  const found = await getInviteeByToken(token);
  if (!found) {
    return NextResponse.json({ error: "This invitation link is not valid." }, { status: 404 });
  }

  const parsed = rsvpFormSchema.safeParse(formFields);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Please check the RSVP details." },
      { status: 422 },
    );
  }

  await logRsvpStarted(found.event.id, "token");

  try {
    await submitRsvp(found.invitee.id, parsed.data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save RSVP." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}

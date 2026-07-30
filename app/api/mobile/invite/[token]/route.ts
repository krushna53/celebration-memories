import "server-only";
import { NextResponse } from "next/server";

import { getInviteeByToken } from "@/services/invitees";
import { logInviteOpened } from "@/services/tracking";

export const dynamic = "force-dynamic";

/**
 * Public, token-gated JSON endpoint for the companion mobile app
 * (../../../../../mobile-app — a separate Expo project, not part of this
 * Next.js build). Mirrors app/invite/[token]/page.tsx's server-side data
 * fetch exactly, just returned as JSON instead of rendered HTML: same
 * getInviteeByToken lookup, same logInviteOpened tracking call, same
 * trust boundary (a token is effectively a bearer credential for one
 * guest's own data — never trust a client-supplied inviteeId instead).
 *
 * No admin auth here by design — an invite token IS the credential,
 * exactly as it already is for the public web invite link. No secrets
 * are exposed: this returns the same invitee/event/RSVP fields the web
 * page already shows that guest.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const found = await getInviteeByToken(token);

  if (!found) {
    return NextResponse.json({ error: "This invitation link is not valid." }, { status: 404 });
  }

  await logInviteOpened(found.invitee.id, {
    userAgent: request.headers.get("user-agent"),
    referral: "mobile-app",
  });

  return NextResponse.json({
    invitee: found.invitee,
    event: found.event,
    existingRsvp: found.existingRsvp,
  });
}

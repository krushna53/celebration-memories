import "server-only";
import { NextResponse } from "next/server";

import { getInviteeByToken } from "@/services/invitees";
import { getMemoryWallItems } from "@/services/memory-wall";

export const dynamic = "force-dynamic";

/**
 * Public, token-gated Memory Wall feed for the companion mobile app.
 * Resolves the event from the guest's own invite token (same trust
 * boundary as ../../invite/[token]/route.ts) rather than accepting a
 * raw eventId, then reuses the same getMemoryWallItems the web
 * Memory Wall section renders — approved photos/videos/audio/guestbook
 * entries, newest first.
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

  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 30;

  const items = await getMemoryWallItems(found.event.id, limit);
  return NextResponse.json({ items });
}

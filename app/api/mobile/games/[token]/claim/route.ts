import "server-only";
import { NextResponse } from "next/server";

import { getGameByShareToken, claimPrize } from "@/services/games";

export const dynamic = "force-dynamic";

/** Claims a housie/movie_housie prize — relies on claimPrize's partial-unique-index-backed "first valid claim wins" (see services/games.ts). */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const game = await getGameByShareToken(token);
  if (!game) {
    return NextResponse.json({ error: "This game link isn't active anymore." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { ticketId, pattern } = (body ?? {}) as { ticketId?: string; pattern?: string };
  if (!ticketId || typeof ticketId !== "string" || !pattern || typeof pattern !== "string") {
    return NextResponse.json({ error: "Missing ticket or prize." }, { status: 400 });
  }

  try {
    const result = await claimPrize(game.id, ticketId, pattern);
    if (!result.valid) {
      return NextResponse.json({ error: result.reason }, { status: 422 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't submit your claim." },
      { status: 500 },
    );
  }
}

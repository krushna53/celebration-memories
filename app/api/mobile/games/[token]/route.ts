import "server-only";
import { NextResponse } from "next/server";

import { getGameByShareToken } from "@/services/games";

export const dynamic = "force-dynamic";

/**
 * Public, token-gated game lookup for the companion mobile app. Also
 * doubles as the guest device's poll target for housie/movie_housie's
 * live calling state (calledItems/status) — cheap enough to re-fetch
 * the whole row every few seconds rather than adding a second endpoint,
 * mirroring getGameCallStateAction's re-resolve-by-token behavior.
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const game = await getGameByShareToken(token);
  if (!game) {
    return NextResponse.json({ error: "This game link isn't active anymore." }, { status: 404 });
  }
  return NextResponse.json({ game });
}

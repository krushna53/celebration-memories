import "server-only";
import { NextResponse } from "next/server";

import { getGameByShareToken, startGameAttempt } from "@/services/games";
import { gamePlayerIdentitySchema } from "@/types/games";

export const dynamic = "force-dynamic";

/** Starts a word-search attempt — identifies the player by phone (matching/creating an invitee, same as public RSVP). */
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

  const parsed = gamePlayerIdentitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Please check your details and try again." },
      { status: 422 },
    );
  }

  try {
    const attempt = await startGameAttempt(game, parsed.data);
    return NextResponse.json({ attempt });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't start the game." },
      { status: 500 },
    );
  }
}

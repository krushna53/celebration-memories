import "server-only";
import { NextResponse } from "next/server";

import { getGameByShareToken, joinTicketGame } from "@/services/games";
import { gamePlayerIdentitySchema } from "@/types/games";

export const dynamic = "force-dynamic";

/** Joins a housie/movie_housie game — returns the player's existing ticket if they've already joined, or a fresh one (see joinTicketGame's unique-index-backed rejoin logic). */
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
    const ticket = await joinTicketGame(game, parsed.data);
    return NextResponse.json({ ticket, gameId: game.id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't join the game." },
      { status: 500 },
    );
  }
}

import "server-only";
import { NextResponse } from "next/server";

import { completeGameAttempt } from "@/services/games";

export const dynamic = "force-dynamic";

/**
 * Records a finished word-search attempt. Takes attemptId only (not the
 * token) — mirrors completeGameAttemptAction on the web exactly, which
 * treats the attempt id itself (an unguessable UUID) as the bearer
 * credential rather than re-checking it against the game/token.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { attemptId, foundWords, durationSeconds } = (body ?? {}) as {
    attemptId?: string;
    foundWords?: unknown;
    durationSeconds?: unknown;
  };

  if (!attemptId || typeof attemptId !== "string") {
    return NextResponse.json({ error: "Missing attempt id." }, { status: 400 });
  }

  try {
    await completeGameAttempt(attemptId, {
      foundWords: Array.isArray(foundWords) ? foundWords.filter((w): w is string => typeof w === "string") : [],
      durationSeconds: typeof durationSeconds === "number" ? durationSeconds : 0,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't record your result." },
      { status: 500 },
    );
  }
}

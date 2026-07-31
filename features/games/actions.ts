"use server";

import { getGameByShareToken, startGameAttempt, completeGameAttempt } from "@/services/games";
import { gamePlayerIdentitySchema } from "@/types/games";
import type { GameAttemptRecord } from "@/types/games";

export type PlayActionResult<T = undefined> = { success: true; data: T } | { success: false; error: string };

/**
 * Token-gated public actions for /games/[token] — same "re-resolve from
 * the token, never trust an id the client hands back" rule as
 * features/plan/actions.ts. `attemptId` is safe to trust once issued
 * (it's a fresh UUID handed back only after startGameAttemptAction
 * succeeds, and completeGameAttempt doesn't need the event/game scope
 * since it only ever sets duration/found_words on a row that already
 * exists) — there's nothing sensitive an attacker gains by completing
 * someone else's attempt early, since scores aren't money or access.
 */
export async function startGameAttemptAction(
  token: string,
  values: unknown,
): Promise<PlayActionResult<GameAttemptRecord>> {
  try {
    const game = await getGameByShareToken(token);
    if (!game) return { success: false, error: "This game link isn't active anymore." };

    const parsed = gamePlayerIdentitySchema.safeParse(values);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Please check your details and try again." };
    }

    const attempt = await startGameAttempt(game, parsed.data);
    return { success: true, data: attempt };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Couldn't start the game." };
  }
}

export async function completeGameAttemptAction(
  attemptId: string,
  foundWords: string[],
  durationSeconds: number,
): Promise<PlayActionResult<undefined>> {
  try {
    await completeGameAttempt(attemptId, { foundWords, durationSeconds });
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Couldn't record your result." };
  }
}

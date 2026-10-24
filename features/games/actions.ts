"use server";

import {
  getGameByShareToken,
  startGameAttempt,
  completeGameAttempt,
  joinTicketGame,
  getGameCallState,
  claimPrize,
  getSoloLeaderboard,
} from "@/services/games";
import { gamePlayerIdentitySchema } from "@/types/games";
import type { GameAttemptRecord, GameTicketRecord, GameStatus } from "@/types/games";

export type PlayActionResult<T = undefined> = { success: true; data: T } | { success: false; error: string };

/**
 * Token-gated public actions for /games/[token] — same "re-resolve from
 * the token, never trust an id the client hands back" rule as
 * features/plan/actions.ts.
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
  score?: number | null,
): Promise<PlayActionResult<undefined>> {
  try {
    if (!Array.isArray(foundWords) || !Number.isFinite(durationSeconds) || durationSeconds < 0) {
      return { success: false, error: "Couldn't record your result." };
    }
    await completeGameAttempt(attemptId, { foundWords: foundWords.slice(0, 50), durationSeconds: Math.round(durationSeconds), score });
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Couldn't record your result." };
  }
}

/** Joins a housie/movie_housie game — returns the player's existing ticket if they've already joined, or a fresh one. */
export async function joinTicketGameAction(
  token: string,
  values: unknown,
): Promise<PlayActionResult<{ ticket: GameTicketRecord; gameId: string }>> {
  try {
    const game = await getGameByShareToken(token);
    if (!game) return { success: false, error: "This game link isn't active anymore." };

    const parsed = gamePlayerIdentitySchema.safeParse(values);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Please check your details and try again." };
    }

    const ticket = await joinTicketGame(game, parsed.data);
    return { success: true, data: { ticket, gameId: game.id } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Couldn't join the game." };
  }
}

/** Poll target for a guest's device — re-resolves the game from the token each time rather than trusting a bare gameId. */
export async function getGameCallStateAction(
  token: string,
): Promise<PlayActionResult<{ calledItems: (number | string)[]; status: GameStatus }>> {
  try {
    const game = await getGameByShareToken(token);
    if (!game) return { success: false, error: "This game link isn't active anymore." };
    const state = await getGameCallState(game.id);
    return { success: true, data: state };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Couldn't refresh the game." };
  }
}

export async function claimPrizeAction(
  token: string,
  ticketId: string,
  pattern: string,
): Promise<PlayActionResult<undefined>> {
  try {
    const game = await getGameByShareToken(token);
    if (!game) return { success: false, error: "This game link isn't active anymore." };
    const result = await claimPrize(game.id, ticketId, pattern);
    if (!result.valid) return { success: false, error: result.reason };
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Couldn't submit your claim." };
  }
}

/** Resolve access from the share link; expose names and results only. */
export async function getSoloLeaderboardAction(token: string) {
  try {
    const game = await getGameByShareToken(token);
    if (!game) return { success: false as const, error: "This game link isn't active anymore." };
    return { success: true as const, data: await getSoloLeaderboard(game) };
  } catch {
    return { success: false as const, error: "Couldn't load the scoreboard." };
  }
}

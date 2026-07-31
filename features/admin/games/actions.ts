"use server";

import { revalidatePath } from "next/cache";

import { requireAdminForEvent } from "@/services/admin-auth";
import {
  createWordSearchGame,
  createHousieGame,
  createMovieHousieGame,
  setGameActive,
  setGameStatus,
  deleteGame,
  callNextItem,
} from "@/services/games";
import {
  createWordSearchFormSchema,
  createHousieFormSchema,
  createMovieHousieFormSchema,
} from "@/types/games";
import type { GameRecord, GameStatus } from "@/types/games";

export type GameActionResult<T = undefined> = { success: true; data: T } | { success: false; error: string };

function splitLines(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((w) => w.trim())
    .filter(Boolean);
}

export async function createWordSearchGameAction(
  eventId: string,
  values: unknown,
): Promise<GameActionResult<GameRecord>> {
  try {
    await requireAdminForEvent(eventId);
    const parsed = createWordSearchFormSchema.safeParse(values);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
    }
    const game = await createWordSearchGame(eventId, {
      title: parsed.data.title,
      words: splitLines(parsed.data.wordsText),
    });
    revalidatePath("/admin/games");
    return { success: true, data: game };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to create game." };
  }
}

export async function createHousieGameAction(eventId: string, values: unknown): Promise<GameActionResult<GameRecord>> {
  try {
    await requireAdminForEvent(eventId);
    const parsed = createHousieFormSchema.safeParse(values);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
    }
    const game = await createHousieGame(eventId, { title: parsed.data.title });
    revalidatePath("/admin/games");
    return { success: true, data: game };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to create game." };
  }
}

export async function createMovieHousieGameAction(
  eventId: string,
  values: unknown,
): Promise<GameActionResult<GameRecord>> {
  try {
    await requireAdminForEvent(eventId);
    const parsed = createMovieHousieFormSchema.safeParse(values);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
    }
    const game = await createMovieHousieGame(eventId, {
      title: parsed.data.title,
      pool: splitLines(parsed.data.poolText),
    });
    revalidatePath("/admin/games");
    return { success: true, data: game };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to create game." };
  }
}

export async function setGameActiveAction(
  eventId: string,
  gameId: string,
  isActive: boolean,
): Promise<GameActionResult<undefined>> {
  try {
    await requireAdminForEvent(eventId);
    await setGameActive(eventId, gameId, isActive);
    revalidatePath("/admin/games");
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update game." };
  }
}

export async function setGameStatusAction(
  eventId: string,
  gameId: string,
  status: GameStatus,
): Promise<GameActionResult<undefined>> {
  try {
    await requireAdminForEvent(eventId);
    await setGameStatus(eventId, gameId, status);
    revalidatePath("/admin/games");
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update game status." };
  }
}

export async function callNextItemAction(
  eventId: string,
  gameId: string,
): Promise<GameActionResult<number | string | null>> {
  try {
    await requireAdminForEvent(eventId);
    const next = await callNextItem(eventId, gameId);
    revalidatePath("/admin/games");
    return { success: true, data: next };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to call next." };
  }
}

export async function deleteGameAction(eventId: string, gameId: string): Promise<GameActionResult<undefined>> {
  try {
    await requireAdminForEvent(eventId);
    await deleteGame(eventId, gameId);
    revalidatePath("/admin/games");
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to delete game." };
  }
}

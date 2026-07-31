"use server";

import { revalidatePath } from "next/cache";

import { requireAdminForEvent } from "@/services/admin-auth";
import { createWordSearchGame, setGameActive, deleteGame } from "@/services/games";
import { createWordSearchFormSchema } from "@/types/games";
import type { GameRecord } from "@/types/games";

export type GameActionResult<T = undefined> = { success: true; data: T } | { success: false; error: string };

function splitWords(text: string): string[] {
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
      words: splitWords(parsed.data.wordsText),
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

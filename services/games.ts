import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateDraftToken } from "@/lib/tokens";
import { generateWordSearch } from "@/lib/word-search";
import { findOrCreateSelfInvitee } from "@/services/public-rsvp";
import type { GameRecord, GameAttemptRecord, WordSearchConfig, GamePlayerIdentity } from "@/types/games";

/**
 * Backing service for digital party games (features/admin/games,
 * features/games). `event_games`/`game_attempts` are deliberately
 * generic (a `type` + freeform `config`/jsonb columns) even though
 * word search is the only type implemented right now — Housie and
 * movie-name-housie (see CLAUDE.md follow-ups) are meant to slot into
 * the same two tables with a different `type` and `config` shape,
 * rather than each needing their own migration.
 *
 * Guest identification reuses findOrCreateSelfInvitee — the exact same
 * phone-based "are you already on the RSVP list?" match the public
 * RSVP page uses — so a guest arriving via the game's QR code who's
 * already an invitee gets linked to that record instead of creating a
 * disconnected duplicate.
 */

interface GameRow {
  id: string;
  event_id: string;
  type: "word_search";
  title: string;
  config: WordSearchConfig;
  share_token: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface GameAttemptRow {
  id: string;
  game_id: string;
  event_id: string;
  invitee_id: string | null;
  player_name: string;
  player_phone: string | null;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  found_words: string[];
  created_at: string;
}

function mapGame(row: GameRow): GameRecord {
  return {
    id: row.id,
    eventId: row.event_id,
    type: row.type,
    title: row.title,
    config: row.config,
    shareToken: row.share_token,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAttempt(row: GameAttemptRow): GameAttemptRecord {
  return {
    id: row.id,
    gameId: row.game_id,
    eventId: row.event_id,
    inviteeId: row.invitee_id,
    playerName: row.player_name,
    playerPhone: row.player_phone,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    durationSeconds: row.duration_seconds,
    foundWords: row.found_words,
    createdAt: row.created_at,
  };
}

export async function listEventGames(eventId: string): Promise<GameRecord[]> {
  const { data, error } = await supabaseAdmin()
    .from("event_games")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load games: ${error.message}`);
  return (data ?? []).map(mapGame);
}

export async function createWordSearchGame(
  eventId: string,
  input: { title: string; words: string[] },
): Promise<GameRecord> {
  const puzzle = generateWordSearch(input.words);
  if (puzzle.words.length < 3) {
    throw new Error("Couldn't fit enough words into a puzzle — try shorter words or fewer of them.");
  }

  const { data, error } = await supabaseAdmin()
    .from("event_games")
    .insert({
      event_id: eventId,
      type: "word_search",
      title: input.title,
      config: puzzle,
      share_token: generateDraftToken(),
    })
    .select("*")
    .single<GameRow>();

  if (error || !data) throw new Error(`Failed to create game: ${error?.message}`);
  return mapGame(data);
}

export async function setGameActive(eventId: string, gameId: string, isActive: boolean): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("event_games")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", gameId)
    .eq("event_id", eventId);
  if (error) throw new Error(`Failed to update game: ${error.message}`);
}

export async function deleteGame(eventId: string, gameId: string): Promise<void> {
  const { error } = await supabaseAdmin().from("event_games").delete().eq("id", gameId).eq("event_id", eventId);
  if (error) throw new Error(`Failed to delete game: ${error.message}`);
}

/** Resolves a game by its public share token — only returns active games, same "stop resolving once turned off" behavior as the wizard's claimed draft tokens. */
export async function getGameByShareToken(token: string): Promise<GameRecord | null> {
  const { data, error } = await supabaseAdmin()
    .from("event_games")
    .select("*")
    .eq("share_token", token)
    .eq("is_active", true)
    .maybeSingle<GameRow>();

  if (error) {
    console.error("getGameByShareToken failed:", error.message);
    return null;
  }
  return data ? mapGame(data) : null;
}

export async function listGameAttempts(gameId: string): Promise<GameAttemptRecord[]> {
  const { data, error } = await supabaseAdmin()
    .from("game_attempts")
    .select("*")
    .eq("game_id", gameId)
    .order("duration_seconds", { ascending: true, nullsFirst: false });

  if (error) throw new Error(`Failed to load leaderboard: ${error.message}`);
  return (data ?? []).map(mapAttempt);
}

/** Identifies the player (matching/creating an invitee by phone, same as public RSVP) and opens a new attempt row. */
export async function startGameAttempt(game: GameRecord, identity: GamePlayerIdentity): Promise<GameAttemptRecord> {
  const invitee = await findOrCreateSelfInvitee(game.eventId, { name: identity.name, phone: identity.phone });

  const { data, error } = await supabaseAdmin()
    .from("game_attempts")
    .insert({
      game_id: game.id,
      event_id: game.eventId,
      invitee_id: invitee.id,
      player_name: identity.name,
      player_phone: identity.phone,
    })
    .select("*")
    .single<GameAttemptRow>();

  if (error || !data) throw new Error(`Failed to start game: ${error?.message}`);
  return mapAttempt(data);
}

export async function completeGameAttempt(
  attemptId: string,
  input: { foundWords: string[]; durationSeconds: number },
): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("game_attempts")
    .update({
      completed_at: new Date().toISOString(),
      duration_seconds: input.durationSeconds,
      found_words: input.foundWords,
    })
    .eq("id", attemptId);
  if (error) throw new Error(`Failed to record completion: ${error.message}`);
}

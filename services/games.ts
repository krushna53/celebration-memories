import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateDraftToken } from "@/lib/tokens";
import { generateWordSearch } from "@/lib/word-search";
import {
  generateHousieTicket,
  generateMovieTicket,
  validateHousieClaim,
  validateMovieClaim,
  HOUSIE_PATTERNS,
  MOVIE_PATTERNS,
  type HousiePattern,
  type MoviePattern,
  type HousieTicket,
  type MovieTicket,
} from "@/lib/housie";
import { findOrCreateSelfInvitee } from "@/services/public-rsvp";
import type {
  GameRecord,
  GameAttemptRecord,
  GameTicketRecord,
  GameClaimRecord,
  WordSearchConfig,
  HousieConfig,
  MovieHousieConfig,
  GamePlayerIdentity,
  GameStatus,
  GameType,
} from "@/types/games";

/**
 * Backing service for digital party games (features/admin/games,
 * features/games). `event_games`/`game_attempts` cover word search
 * (a solo, timed game); `game_tickets`/`game_claims` cover the two
 * "calling" games — Housie and its movie-name variant — which are
 * fundamentally multiplayer: one shared list of called items
 * (`event_games.called_items`), many tickets, and a race to claim each
 * prize first. `game_claims` relies on a partial unique index
 * (game_id, pattern) WHERE is_valid — see migration add_housie_games —
 * to make "first valid claim wins" atomic at the database level rather
 * than trusting application-level check-then-insert timing.
 *
 * Guest identification reuses findOrCreateSelfInvitee (the same
 * phone-based "are you already on the RSVP list?" match the public
 * RSVP page uses), same as word search.
 */

interface GameRow {
  id: string;
  event_id: string;
  type: GameType;
  title: string;
  config: WordSearchConfig | HousieConfig | MovieHousieConfig;
  share_token: string;
  is_active: boolean;
  called_items: (number | string)[];
  status: GameStatus;
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

interface GameTicketRow {
  id: string;
  game_id: string;
  invitee_id: string | null;
  player_name: string;
  player_phone: string | null;
  ticket: HousieTicket | MovieTicket;
  created_at: string;
}

interface GameClaimRow {
  id: string;
  game_id: string;
  ticket_id: string;
  pattern: string;
  is_valid: boolean;
  player_name: string;
  claimed_at: string;
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
    calledItems: row.called_items,
    status: row.status,
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

function mapTicket(row: GameTicketRow): GameTicketRecord {
  return {
    id: row.id,
    gameId: row.game_id,
    inviteeId: row.invitee_id,
    playerName: row.player_name,
    playerPhone: row.player_phone,
    ticket: row.ticket,
    createdAt: row.created_at,
  };
}

function mapClaim(row: GameClaimRow): GameClaimRecord {
  return {
    id: row.id,
    gameId: row.game_id,
    ticketId: row.ticket_id,
    pattern: row.pattern,
    isValid: row.is_valid,
    playerName: row.player_name,
    claimedAt: row.claimed_at,
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

export async function createHousieGame(eventId: string, input: { title: string }): Promise<GameRecord> {
  const config: HousieConfig = { patterns: HOUSIE_PATTERNS.map((p) => p.id) };
  const { data, error } = await supabaseAdmin()
    .from("event_games")
    .insert({
      event_id: eventId,
      type: "housie",
      title: input.title,
      config,
      share_token: generateDraftToken(),
    })
    .select("*")
    .single<GameRow>();

  if (error || !data) throw new Error(`Failed to create game: ${error?.message}`);
  return mapGame(data);
}

export async function createMovieHousieGame(eventId: string, input: { title: string; pool: string[] }): Promise<GameRecord> {
  if (input.pool.length < 25) {
    throw new Error("Need at least 25 movie names for a 5x5 card.");
  }
  const config: MovieHousieConfig = { pool: input.pool, patterns: MOVIE_PATTERNS.map((p) => p.id) };
  const { data, error } = await supabaseAdmin()
    .from("event_games")
    .insert({
      event_id: eventId,
      type: "movie_housie",
      title: input.title,
      config,
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

/** Start/pause/end a calling game (housie/movie_housie) — word search ignores this. */
export async function setGameStatus(eventId: string, gameId: string, status: GameStatus): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("event_games")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", gameId)
    .eq("event_id", eventId);
  if (error) throw new Error(`Failed to update game status: ${error.message}`);
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

export async function getGameById(eventId: string, gameId: string): Promise<GameRecord | null> {
  const { data, error } = await supabaseAdmin()
    .from("event_games")
    .select("*")
    .eq("id", gameId)
    .eq("event_id", eventId)
    .maybeSingle<GameRow>();
  if (error) throw new Error(`Failed to load game: ${error.message}`);
  return data ? mapGame(data) : null;
}

/** Lightweight poll target for guest devices — just the caller state, not the whole game row. */
export async function getGameCallState(gameId: string): Promise<{ calledItems: (number | string)[]; status: GameStatus }> {
  const { data, error } = await supabaseAdmin()
    .from("event_games")
    .select("called_items, status")
    .eq("id", gameId)
    .single<{ called_items: (number | string)[]; status: GameStatus }>();
  if (error || !data) throw new Error(`Failed to load game state: ${error?.message}`);
  return { calledItems: data.called_items, status: data.status };
}

/**
 * Draws the next number (housie) or movie name (movie_housie) not
 * already called, appends it, and returns it. Read-modify-write on a
 * single row — fine for this use case since only the admin/host calls
 * next, one at a time, never concurrently.
 */
export async function callNextItem(eventId: string, gameId: string): Promise<number | string | null> {
  const game = await getGameById(eventId, gameId);
  if (!game) throw new Error("Game not found.");

  const called = new Set(game.calledItems);
  let next: number | string | null = null;

  if (game.type === "housie") {
    const pool = Array.from({ length: 90 }, (_, i) => i + 1).filter((n) => !called.has(n));
    if (pool.length > 0) next = pool[Math.floor(Math.random() * pool.length)]!;
  } else if (game.type === "movie_housie") {
    const config = game.config as MovieHousieConfig;
    const pool = config.pool.filter((m) => !called.has(m));
    if (pool.length > 0) next = pool[Math.floor(Math.random() * pool.length)]!;
  } else {
    throw new Error("This game type doesn't support calling.");
  }

  if (next === null) return null; // pool exhausted

  const updatedItems = [...game.calledItems, next];
  const { error } = await supabaseAdmin()
    .from("event_games")
    .update({ called_items: updatedItems, status: "live", updated_at: new Date().toISOString() })
    .eq("id", gameId)
    .eq("event_id", eventId);
  if (error) throw new Error(`Failed to call next item: ${error.message}`);

  return next;
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

/**
 * Joins a housie/movie_housie game: matches/creates the invitee by
 * phone, then returns their existing ticket for this game if they've
 * already joined (so refreshing the page never regenerates a new
 * ticket out from under them — the unique index on
 * (game_id, invitee_id) is what makes that safe to rely on), or
 * generates and saves a new one.
 */
export async function joinTicketGame(game: GameRecord, identity: GamePlayerIdentity): Promise<GameTicketRecord> {
  const invitee = await findOrCreateSelfInvitee(game.eventId, { name: identity.name, phone: identity.phone });

  const { data: existing, error: lookupError } = await supabaseAdmin()
    .from("game_tickets")
    .select("*")
    .eq("game_id", game.id)
    .eq("invitee_id", invitee.id)
    .maybeSingle<GameTicketRow>();
  if (lookupError) throw new Error(`Failed to check for an existing ticket: ${lookupError.message}`);
  if (existing) return mapTicket(existing);

  const ticket = game.type === "housie" ? generateHousieTicket() : generateMovieTicket((game.config as MovieHousieConfig).pool);

  const { data, error } = await supabaseAdmin()
    .from("game_tickets")
    .insert({
      game_id: game.id,
      invitee_id: invitee.id,
      player_name: identity.name,
      player_phone: identity.phone,
      ticket,
    })
    .select("*")
    .single<GameTicketRow>();

  if (error || !data) throw new Error(`Failed to create your ticket: ${error?.message}`);
  return mapTicket(data);
}

export async function getTicketById(ticketId: string): Promise<GameTicketRecord | null> {
  const { data, error } = await supabaseAdmin().from("game_tickets").select("*").eq("id", ticketId).maybeSingle<GameTicketRow>();
  if (error) throw new Error(`Failed to load ticket: ${error.message}`);
  return data ? mapTicket(data) : null;
}

export async function listTicketsForGame(gameId: string): Promise<GameTicketRecord[]> {
  const { data, error } = await supabaseAdmin()
    .from("game_tickets")
    .select("*")
    .eq("game_id", gameId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to load tickets: ${error.message}`);
  return (data ?? []).map(mapTicket);
}

export async function listClaimsForGame(gameId: string): Promise<GameClaimRecord[]> {
  const { data, error } = await supabaseAdmin()
    .from("game_claims")
    .select("*")
    .eq("game_id", gameId)
    .eq("is_valid", true)
    .order("claimed_at", { ascending: true });
  if (error) throw new Error(`Failed to load claims: ${error.message}`);
  return (data ?? []).map(mapClaim);
}

export type ClaimResult = { valid: true } | { valid: false; reason: string };

/**
 * Validates a claim and, if valid, inserts it — relying on the partial
 * unique index (game_id, pattern) WHERE is_valid for atomic "first
 * valid claim wins" (a duplicate insert attempt fails with a unique
 * violation, which is treated as "someone already won this").
 */
export async function claimPrize(gameId: string, ticketId: string, pattern: string): Promise<ClaimResult> {
  const [game, ticket] = await Promise.all([
    supabaseAdmin().from("event_games").select("*").eq("id", gameId).single<GameRow>(),
    getTicketById(ticketId),
  ]);
  if (game.error || !game.data) return { valid: false, reason: "Game not found." };
  if (!ticket || ticket.gameId !== gameId) return { valid: false, reason: "Ticket not found." };

  const gameRecord = mapGame(game.data);
  const isKnownPattern = pattern in { early_five: 1, top_line: 1, middle_line: 1, bottom_line: 1, full_house: 1, line: 1 };
  if (!isKnownPattern) return { valid: false, reason: "Unknown prize." };

  const isValid =
    gameRecord.type === "housie"
      ? validateHousieClaim(ticket.ticket as HousieTicket, gameRecord.calledItems as number[], pattern as HousiePattern)
      : gameRecord.type === "movie_housie"
        ? validateMovieClaim(ticket.ticket as MovieTicket, gameRecord.calledItems as string[], pattern as MoviePattern)
        : false;

  if (!isValid) return { valid: false, reason: "Not complete yet — keep playing!" };

  const { error: insertError } = await supabaseAdmin().from("game_claims").insert({
    game_id: gameId,
    ticket_id: ticketId,
    pattern,
    is_valid: true,
    player_name: ticket.playerName,
  });

  if (insertError) {
    if (insertError.code === "23505") return { valid: false, reason: "Someone already claimed this prize first!" };
    return { valid: false, reason: `Failed to record claim: ${insertError.message}` };
  }

  return { valid: true };
}

import { z } from "zod";
import type { HousieTicket, MovieTicket, HousiePattern, MoviePattern } from "@/lib/housie";

export type GameType = "word_search" | "housie" | "movie_housie";
export type GameStatus = "waiting" | "live" | "ended";

export interface WordSearchConfig {
  words: string[];
  grid: string[][];
  size: number;
}

export interface HousieConfig {
  patterns: HousiePattern[];
}

export interface MovieHousieConfig {
  pool: string[];
  patterns: MoviePattern[];
}

export type GameConfig = WordSearchConfig | HousieConfig | MovieHousieConfig;

export interface GameRecord {
  id: string;
  eventId: string;
  type: GameType;
  title: string;
  config: WordSearchConfig | HousieConfig | MovieHousieConfig;
  shareToken: string;
  isActive: boolean;
  calledItems: (number | string)[];
  status: GameStatus;
  createdAt: string;
  updatedAt: string;
}

export interface GameAttemptRecord {
  id: string;
  gameId: string;
  eventId: string;
  inviteeId: string | null;
  playerName: string;
  playerPhone: string | null;
  startedAt: string;
  completedAt: string | null;
  durationSeconds: number | null;
  foundWords: string[];
  createdAt: string;
}

export interface GameTicketRecord {
  id: string;
  gameId: string;
  inviteeId: string | null;
  playerName: string;
  playerPhone: string | null;
  ticket: HousieTicket | MovieTicket;
  createdAt: string;
}

export interface GameClaimRecord {
  id: string;
  gameId: string;
  ticketId: string;
  pattern: string;
  isValid: boolean;
  playerName: string;
  claimedAt: string;
}

export const createWordSearchFormSchema = z.object({
  title: z.string().trim().min(1, "Please add a title.").max(120),
  wordsText: z
    .string()
    .trim()
    .min(1, "Add at least a few words.")
    .refine((text) => text.split(/[\n,]/).map((w) => w.trim()).filter(Boolean).length >= 3, {
      message: "Add at least 3 words.",
    }),
});
export type CreateWordSearchFormValues = z.infer<typeof createWordSearchFormSchema>;

export const createHousieFormSchema = z.object({
  title: z.string().trim().min(1, "Please add a title.").max(120),
});
export type CreateHousieFormValues = z.infer<typeof createHousieFormSchema>;

export const createMovieHousieFormSchema = z.object({
  title: z.string().trim().min(1, "Please add a title.").max(120),
  poolText: z
    .string()
    .trim()
    .min(1, "Add at least 25 movie names.")
    .refine((text) => text.split(/[\n,]/).map((w) => w.trim()).filter(Boolean).length >= 25, {
      message: "Add at least 25 movie names (for a 5x5 card).",
    }),
});
export type CreateMovieHousieFormValues = z.infer<typeof createMovieHousieFormSchema>;

export const gamePlayerIdentitySchema = z.object({
  name: z.string().trim().min(1, "Please enter your name.").max(120),
  phone: z.string().trim().min(7, "Please enter a valid phone number.").max(20),
});
export type GamePlayerIdentity = z.infer<typeof gamePlayerIdentitySchema>;

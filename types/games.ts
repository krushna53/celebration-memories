import { z } from "zod";

export type GameType = "word_search";

export interface WordSearchConfig {
  words: string[];
  grid: string[][];
  size: number;
}

export interface GameRecord {
  id: string;
  eventId: string;
  type: GameType;
  title: string;
  config: WordSearchConfig;
  shareToken: string;
  isActive: boolean;
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

export const gamePlayerIdentitySchema = z.object({
  name: z.string().trim().min(1, "Please enter your name.").max(120),
  phone: z.string().trim().min(7, "Please enter a valid phone number.").max(20),
});
export type GamePlayerIdentity = z.infer<typeof gamePlayerIdentitySchema>;

/**
 * A community-contributed, config-only template. See
 * supabase/migrations/0005_template_submissions.sql and
 * services/template-submissions.ts.
 */
import { z } from "zod";
import type { TemplateAnimationPersonality } from "@/lib/template-catalog";

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export const templateSubmissionFormSchema = z.object({
  name: z.string().trim().min(2, "Please name your template.").max(60),
  description: z.string().trim().min(10, "Add a short description.").max(300),
  category: z.enum(["general", "kids", "formal", "festive", "romantic"]),
  authorName: z.string().trim().min(2, "Please enter your name.").max(80),
  authorWebsite: z
    .string()
    .trim()
    .url("Please enter a full URL (including https://).")
    .max(200)
    .optional()
    .or(z.literal("")),
  authorEmail: z.string().trim().email("Please enter a valid email address.").max(160),
  baseDarkColor: z.string().trim().regex(HEX_COLOR, "Enter a valid hex color, e.g. #0a1f1a."),
  baseAccentColor: z.string().trim().regex(HEX_COLOR, "Enter a valid hex color, e.g. #c9a227."),
  baseLightColor: z.string().trim().regex(HEX_COLOR, "Enter a valid hex color, e.g. #fffdf7."),
  fontDisplay: z.string().trim().min(2, "Enter a Google Fonts family name.").max(60),
  animation: z.enum(["luxury", "playful", "energetic", "dreamy", "minimal", "festive", "jubilant"]),
});

export type TemplateSubmissionFormValues = z.infer<typeof templateSubmissionFormSchema>;

export type TemplateSubmissionStatus = "pending" | "approved" | "rejected";
export type TemplateSubmissionCategory = "general" | "kids" | "formal" | "festive" | "romantic";

export interface TemplateSubmissionRecord {
  id: string;
  name: string;
  description: string;
  category: TemplateSubmissionCategory;

  authorName: string;
  authorWebsite: string | null;
  /** Contact only — never rendered publicly, only visible to the owner in the review queue. */
  authorEmail: string;

  baseDarkColor: string;
  baseAccentColor: string;
  baseLightColor: string;

  fontDisplay: string;
  animation: TemplateAnimationPersonality;

  status: TemplateSubmissionStatus;
  adminNote: string | null;
  /** Assigned only on approval — doubles as the template's slug in the merged catalog. */
  slug: string | null;

  createdAt: string;
  reviewedAt: string | null;
}

export interface TemplateSubmissionInput {
  name: string;
  description: string;
  category: TemplateSubmissionCategory;
  authorName: string;
  authorWebsite?: string | null;
  authorEmail: string;
  baseDarkColor: string;
  baseAccentColor: string;
  baseLightColor: string;
  fontDisplay: string;
  animation: TemplateAnimationPersonality;
}

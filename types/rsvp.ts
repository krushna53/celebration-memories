import { z } from "zod";

export const MEAL_PREFERENCES = [
  "no_preference",
  "vegetarian",
  "vegan",
  "jain",
  "gluten_free",
  "other",
] as const;

export type MealPreference = (typeof MEAL_PREFERENCES)[number];

export const MEAL_PREFERENCE_LABELS: Record<MealPreference, string> = {
  no_preference: "No preference",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  jain: "Jain",
  gluten_free: "Gluten-free",
  other: "Other",
};

/** Matches the DB `rsvp_status` enum, minus "pending" (a row only exists
 * once the guest has actually responded). */
export const ATTENDANCE_OPTIONS = ["coming", "maybe", "not_coming"] as const;
export type AttendanceOption = (typeof ATTENDANCE_OPTIONS)[number];

export const ATTENDANCE_LABELS: Record<AttendanceOption, string> = {
  coming: "Joyfully Accepts",
  maybe: "Maybe",
  not_coming: "Regretfully Declines",
};

/**
 * Client + server validation schema for the RSVP form. Shared between
 * the form (react-hook-form + zodResolver) and the Server Action so the
 * two can never drift.
 */
export const rsvpFormSchema = z.object({
  name: z.string().trim().min(2, "Please enter your full name.").max(120),
  phone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .or(z.literal(""))
    .transform((val) => (val ? val : undefined)),
  email: z
    .string()
    .trim()
    .email("Please enter a valid email address.")
    .max(160)
    .optional()
    .or(z.literal(""))
    .transform((val) => (val ? val : undefined)),
  coming: z.enum(ATTENDANCE_OPTIONS, {
    message: "Please let us know if you can make it.",
  }),
  adults: z.coerce.number().int().min(0).max(20),
  children: z.coerce.number().int().min(0).max(20),
  mealPreference: z.enum(MEAL_PREFERENCES),
  comments: z.string().trim().max(1000).optional().or(z.literal("")),
});

export type RsvpFormValues = z.infer<typeof rsvpFormSchema>;

export interface RsvpRecord {
  inviteeId: string;
  coming: AttendanceOption;
  adults: number;
  children: number;
  mealPreference: MealPreference;
  comments: string | null;
  submittedAt: string;
}

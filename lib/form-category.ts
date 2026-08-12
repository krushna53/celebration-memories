/**
 * The "RSVP instance" a Custom Form Builder form is for — step 1 of
 * the /forms/new wizard (features/forms/new-form-wizard.tsx). A
 * narrower, form-specific list than the full `EventCategory`
 * (types/event.ts) — obituary/workshop/education/live_stream read
 * fine as *event* categories but are an odd fit for an "RSVP
 * instance," so they're deliberately left off here; a form for one of
 * those still fits under "general." Labels are reused from
 * lib/event-category.ts's EVENT_CATEGORY_LABELS where the value
 * overlaps, so the wording stays consistent with the rest of the app.
 *
 * Deliberately has no runtime dependency on services/custom-forms.ts
 * (which is `import "server-only"`) so this file stays safe to import
 * from client components — the `fieldType` values below are a
 * hand-kept literal union mirroring `CustomFieldType` there rather
 * than a type import, to avoid a cross-module coupling that isn't
 * needed for a handful of string literals. lucide-react icon
 * components are fine to import here though (plain React components,
 * no server/client restriction), so the Step 1 picker's icon lives
 * alongside its label/description in one registry entry rather than a
 * second icon-only lookup in features/forms/new-form-wizard.tsx.
 */
import { Baby, Briefcase, Cake, FileText, Gem, Heart, Palmtree, Users, type LucideIcon } from "lucide-react";

import { EVENT_CATEGORY_LABELS } from "@/lib/event-category";

export type FormCategory =
  | "wedding"
  | "birthday"
  | "baby_shower"
  | "anniversary"
  | "retirement"
  | "corporate"
  | "reunion"
  | "general";

type StarterFieldType = "text" | "textarea" | "email" | "phone" | "number" | "date" | "select" | "radio" | "checkbox";

export interface StarterField {
  label: string;
  fieldType: StarterFieldType;
  required: boolean;
  options: string[] | null;
}

export const FORM_CATEGORY_LABELS: Record<FormCategory, string> = {
  wedding: EVENT_CATEGORY_LABELS.wedding,
  birthday: EVENT_CATEGORY_LABELS.birthday,
  baby_shower: EVENT_CATEGORY_LABELS.baby_shower,
  anniversary: EVENT_CATEGORY_LABELS.anniversary,
  retirement: EVENT_CATEGORY_LABELS.retirement,
  corporate: EVENT_CATEGORY_LABELS.corporate,
  reunion: EVENT_CATEGORY_LABELS.reunion,
  general: "General / Not an RSVP",
};

export const FORM_CATEGORY_OPTIONS: { value: FormCategory; label: string; description: string; icon: LucideIcon }[] = [
  { value: "wedding", label: "Wedding", description: "Meal choice, plus-one, a note for the couple", icon: Heart },
  { value: "birthday", label: "Birthday", description: "Guest count, meal preference, a birthday message", icon: Cake },
  { value: "baby_shower", label: "Baby Shower", description: "Guest count, gift note, meal preference", icon: Baby },
  { value: "anniversary", label: "Anniversary", description: "Guest count, a message for the couple", icon: Gem },
  { value: "retirement", label: "Retirement", description: "Guest count, a message for the retiree", icon: Palmtree },
  { value: "corporate", label: "Corporate Event", description: "Company name, attendee count, dietary needs", icon: Briefcase },
  { value: "reunion", label: "Reunion", description: "Batch/group, guest count, a note to old friends", icon: Users },
  { value: "general", label: "General / Other", description: "Not tied to an occasion — a survey, sign-up, contact form, etc.", icon: FileText },
];

/** Starter fields dropped into a brand-new form when built manually (Step 4) — all fully editable/deletable afterward, just a head start. "general" intentionally starts empty, matching today's default builder experience. */
export const FORM_CATEGORY_STARTER_FIELDS: Record<FormCategory, StarterField[]> = {
  wedding: [
    { label: "Full Name", fieldType: "text", required: true, options: null },
    { label: "Phone Number", fieldType: "phone", required: true, options: null },
    { label: "Will You Attend?", fieldType: "radio", required: true, options: ["Joyfully Accepts", "Regretfully Declines"] },
    { label: "Number of Guests", fieldType: "number", required: true, options: null },
    { label: "Meal Preference", fieldType: "select", required: false, options: ["Vegetarian", "Non-Vegetarian", "Vegan"] },
    { label: "Message for the Couple", fieldType: "textarea", required: false, options: null },
  ],
  birthday: [
    { label: "Full Name", fieldType: "text", required: true, options: null },
    { label: "Phone Number", fieldType: "phone", required: true, options: null },
    { label: "Are You Coming?", fieldType: "radio", required: true, options: ["Yes", "No", "Maybe"] },
    { label: "Number of Guests", fieldType: "number", required: true, options: null },
    { label: "Meal Preference", fieldType: "select", required: false, options: ["Vegetarian", "Non-Vegetarian"] },
    { label: "Message for the Birthday Star", fieldType: "textarea", required: false, options: null },
  ],
  baby_shower: [
    { label: "Full Name", fieldType: "text", required: true, options: null },
    { label: "Phone Number", fieldType: "phone", required: true, options: null },
    { label: "Will You Attend?", fieldType: "radio", required: true, options: ["Yes", "No", "Maybe"] },
    { label: "Number of Guests", fieldType: "number", required: false, options: null },
    { label: "Meal Preference", fieldType: "select", required: false, options: ["Vegetarian", "Non-Vegetarian"] },
    { label: "Gift Note / Registry Link", fieldType: "textarea", required: false, options: null },
  ],
  anniversary: [
    { label: "Full Name", fieldType: "text", required: true, options: null },
    { label: "Phone Number", fieldType: "phone", required: true, options: null },
    { label: "Will You Attend?", fieldType: "radio", required: true, options: ["Yes", "No", "Maybe"] },
    { label: "Number of Guests", fieldType: "number", required: true, options: null },
    { label: "Message for the Couple", fieldType: "textarea", required: false, options: null },
  ],
  retirement: [
    { label: "Full Name", fieldType: "text", required: true, options: null },
    { label: "Phone Number", fieldType: "phone", required: true, options: null },
    { label: "Will You Attend?", fieldType: "radio", required: true, options: ["Yes", "No", "Maybe"] },
    { label: "Number of Guests", fieldType: "number", required: true, options: null },
    { label: "Message for the Retiree", fieldType: "textarea", required: false, options: null },
  ],
  corporate: [
    { label: "Full Name", fieldType: "text", required: true, options: null },
    { label: "Company / Organization", fieldType: "text", required: false, options: null },
    { label: "Email", fieldType: "email", required: true, options: null },
    { label: "Will You Attend?", fieldType: "radio", required: true, options: ["Yes", "No"] },
    { label: "Number of Attendees", fieldType: "number", required: false, options: null },
    { label: "Dietary Restrictions", fieldType: "text", required: false, options: null },
  ],
  reunion: [
    { label: "Full Name", fieldType: "text", required: true, options: null },
    { label: "Phone Number", fieldType: "phone", required: true, options: null },
    { label: "Batch / Group", fieldType: "text", required: false, options: null },
    { label: "Will You Attend?", fieldType: "radio", required: true, options: ["Yes", "No", "Maybe"] },
    { label: "Number of Guests", fieldType: "number", required: false, options: null },
    { label: "Message to Old Friends", fieldType: "textarea", required: false, options: null },
  ],
  general: [],
};

/** Every category except "general" counts as an RSVP-type form for the form_owners.role='rsvp' dashboard filter (services/custom-forms.ts) — null (uncategorized, pre-existing forms) is treated the same as "general": not an RSVP. */
export function isRsvpCategory(category: FormCategory | null | undefined): boolean {
  return Boolean(category) && category !== "general";
}

export function resolveFormCategory(category: string | null | undefined): FormCategory {
  const match = FORM_CATEGORY_OPTIONS.find((option) => option.value === category);
  return match ? match.value : "general";
}

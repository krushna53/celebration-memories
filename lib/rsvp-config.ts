import { z } from "zod";

import { ATTENDANCE_LABELS, ATTENDANCE_OPTIONS, rsvpFormSchema, type AttendanceOption } from "@/types/rsvp";

/**
 * Per-event RSVP form configuration (events.rsvp_config, migration
 * 20261013130000_rsvp_config.sql). Client-safe and pure — the builder UI,
 * both RSVP forms and both Server Actions share it, so what the host sees,
 * what the guest fills in and what the server accepts can't drift.
 *
 * An event with no config gets DEFAULT_RSVP_CONFIG, which is exactly the
 * form every event had before this existed.
 */
export const BUILT_IN_FIELDS = ["phone", "email", "adults", "children", "mealPreference", "comments"] as const;
export type BuiltInField = (typeof BUILT_IN_FIELDS)[number];

/** Fields where "required" makes sense — counts and the meal dropdown always have a value. */
export const REQUIRABLE_FIELDS: readonly BuiltInField[] = ["phone", "email", "comments"];

export const DEFAULT_FIELD_LABELS: Record<BuiltInField, string> = {
  phone: "Phone",
  email: "Email",
  adults: "Adults",
  children: "Children",
  mealPreference: "Meal Preference",
  comments: "Comments",
};

export interface FieldSetting {
  visible: boolean;
  required: boolean;
  /** Custom label; empty = the default label. */
  label: string;
}

export const QUESTION_TYPES = ["text", "long_text", "choice", "yes_no"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  text: "Short answer",
  long_text: "Paragraph",
  choice: "Multiple choice",
  yes_no: "Yes / No",
};

export interface CustomQuestion {
  id: string;
  label: string;
  type: QuestionType;
  /** Choices for "choice" questions (2–10). */
  options: string[];
  required: boolean;
}

export interface RsvpConfig {
  fields: Record<BuiltInField, FieldSetting>;
  /** Custom wording for the attendance choices; empty = default. */
  attendanceLabels: Record<AttendanceOption, string>;
  allowMaybe: boolean;
  questions: CustomQuestion[];
}

export const MAX_QUESTIONS = 10;
const LABEL_MAX = 80;
const OPTION_MAX = 60;

export const DEFAULT_RSVP_CONFIG: RsvpConfig = {
  fields: {
    phone: { visible: true, required: false, label: "" },
    email: { visible: true, required: false, label: "" },
    adults: { visible: true, required: false, label: "" },
    children: { visible: true, required: false, label: "" },
    mealPreference: { visible: true, required: false, label: "" },
    comments: { visible: true, required: false, label: "" },
  },
  attendanceLabels: { coming: "", maybe: "", not_coming: "" },
  allowMaybe: true,
  questions: [],
};

/** A sensible starting point for corporate events — one click in the builder, never applied automatically. */
export const CORPORATE_RSVP_PRESET: RsvpConfig = {
  fields: {
    phone: { visible: true, required: true, label: "Mobile number" },
    email: { visible: true, required: true, label: "Work email" },
    adults: { visible: false, required: false, label: "" },
    children: { visible: false, required: false, label: "" },
    mealPreference: { visible: true, required: false, label: "" },
    comments: { visible: true, required: false, label: "Anything we should know?" },
  },
  attendanceLabels: { coming: "Attending", maybe: "Not sure yet", not_coming: "Can't attend" },
  allowMaybe: true,
  questions: [
    { id: "company", label: "Company / organisation", type: "text", options: [], required: false },
    { id: "designation", label: "Designation", type: "text", options: [], required: false },
  ],
};

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

/** Re-validates stored/posted config; anything unusable falls back to the default for that part. */
export function sanitizeRsvpConfig(input: unknown): RsvpConfig {
  if (!input || typeof input !== "object") return DEFAULT_RSVP_CONFIG;
  const raw = input as Record<string, unknown>;
  const rawFields = (raw.fields && typeof raw.fields === "object" ? raw.fields : {}) as Record<string, unknown>;

  const fields = {} as Record<BuiltInField, FieldSetting>;
  for (const key of BUILT_IN_FIELDS) {
    const f = (rawFields[key] && typeof rawFields[key] === "object" ? rawFields[key] : {}) as Record<string, unknown>;
    const visible = typeof f.visible === "boolean" ? f.visible : true;
    fields[key] = {
      visible,
      required: visible && REQUIRABLE_FIELDS.includes(key) && f.required === true,
      label: cleanText(f.label, LABEL_MAX),
    };
  }

  const rawLabels = (raw.attendanceLabels && typeof raw.attendanceLabels === "object" ? raw.attendanceLabels : {}) as Record<string, unknown>;
  const attendanceLabels = {
    coming: cleanText(rawLabels.coming, 40),
    maybe: cleanText(rawLabels.maybe, 40),
    not_coming: cleanText(rawLabels.not_coming, 40),
  };

  const seen = new Set<string>();
  const questions: CustomQuestion[] = [];
  for (const q of Array.isArray(raw.questions) ? raw.questions : []) {
    if (!q || typeof q !== "object" || questions.length >= MAX_QUESTIONS) continue;
    const r = q as Record<string, unknown>;
    const id = typeof r.id === "string" && /^[a-z0-9_-]{1,40}$/i.test(r.id) ? r.id : null;
    const label = cleanText(r.label, LABEL_MAX);
    const type = QUESTION_TYPES.includes(r.type as QuestionType) ? (r.type as QuestionType) : "text";
    if (!id || !label || seen.has(id)) continue;
    const options =
      type === "choice"
        ? Array.from(new Set((Array.isArray(r.options) ? r.options : []).map((o) => cleanText(o, OPTION_MAX)).filter(Boolean))).slice(0, 10)
        : [];
    if (type === "choice" && options.length < 2) continue;
    seen.add(id);
    questions.push({ id, label, type, options, required: r.required === true });
  }

  return { fields, attendanceLabels, allowMaybe: raw.allowMaybe !== false, questions };
}

export function isDefaultRsvpConfig(config: RsvpConfig): boolean {
  return JSON.stringify(config) === JSON.stringify(DEFAULT_RSVP_CONFIG);
}

export function fieldLabel(config: RsvpConfig, field: BuiltInField): string {
  return config.fields[field].label || DEFAULT_FIELD_LABELS[field];
}

/** Default attendance wording for corporate-type events (lib/event-segment.ts) when the host hasn't set their own; family events keep ATTENDANCE_LABELS. */
export const CORPORATE_ATTENDANCE_LABELS: Record<AttendanceOption, string> = {
  coming: "Attending",
  maybe: "Not sure yet",
  not_coming: "Can't attend",
};

export function attendanceOptions(
  config: RsvpConfig,
  segment: "family" | "corporate" = "family",
): { value: AttendanceOption; label: string }[] {
  const defaults = segment === "corporate" ? CORPORATE_ATTENDANCE_LABELS : ATTENDANCE_LABELS;
  return ATTENDANCE_OPTIONS.filter((o) => o !== "maybe" || config.allowMaybe).map((value) => ({
    value,
    label: config.attendanceLabels[value] || defaults[value],
  }));
}

/**
 * The RSVP schema for one event: the shared base schema plus this event's
 * required fields, allowed attendance options and custom-question answers.
 * `forcePhone` is for the public (no-link) form, where the phone number is
 * the guest's identity and always required.
 */
export function buildRsvpSchema(config: RsvpConfig, options: { forcePhone?: boolean } = {}) {
  return rsvpFormSchema
    // An unanswered radio question arrives as null from the form — treat it as "no answer", not an error.
    .extend({
      answers: z
        .record(z.string(), z.string().max(1000).nullable().transform((v) => v ?? ""))
        .optional(),
    })
    .superRefine((values, ctx) => {
      if (values.coming === "maybe" && !config.allowMaybe) {
        ctx.addIssue({ code: "custom", path: ["coming"], message: "Please choose one of the options." });
      }
      const requirePhone = options.forcePhone || config.fields.phone.required;
      if (requirePhone && !values.phone) {
        ctx.addIssue({ code: "custom", path: ["phone"], message: `Please enter your ${fieldLabel(config, "phone").toLowerCase()}.` });
      }
      if (config.fields.email.required && !values.email) {
        ctx.addIssue({ code: "custom", path: ["email"], message: `Please enter your ${fieldLabel(config, "email").toLowerCase()}.` });
      }
      if (config.fields.comments.required && !values.comments?.trim()) {
        ctx.addIssue({ code: "custom", path: ["comments"], message: "Please fill this in." });
      }
      for (const q of config.questions) {
        const answer = values.answers?.[q.id]?.trim() ?? "";
        if (q.required && !answer) {
          ctx.addIssue({ code: "custom", path: ["answers", q.id], message: "Please answer this question." });
        }
        if (answer && q.type === "choice" && !q.options.includes(answer)) {
          ctx.addIssue({ code: "custom", path: ["answers", q.id], message: "Please choose one of the options." });
        }
        if (answer && q.type === "yes_no" && answer !== "Yes" && answer !== "No") {
          ctx.addIssue({ code: "custom", path: ["answers", q.id], message: "Please choose Yes or No." });
        }
      }
    });
}

/** Keeps only answers to this event's current questions — never stores arbitrary keys a client sent. */
export function pickAnswers(config: RsvpConfig, answers: Record<string, string> | undefined): Record<string, string> | null {
  if (!answers) return null;
  const out: Record<string, string> = {};
  for (const q of config.questions) {
    const value = answers[q.id]?.trim();
    if (value) out[q.id] = value.slice(0, 1000);
  }
  return Object.keys(out).length > 0 ? out : null;
}

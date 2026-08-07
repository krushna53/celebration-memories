import type { EventCategory } from "@/types/event";

/**
 * Single source of truth for the self-serve onboarding wizard's step
 * order — see app/start/[token]/layout.tsx (nav) and each step's
 * page.tsx (prev/next links).
 *
 * The step list is no longer fixed: it's computed from what the host
 * actually wants (see WizardGoal / resolveWizardSteps below), chosen on
 * the new Goals step right after Occasion. Occasion and Goals always
 * run first, in that order, for every draft — everything after that is
 * conditional:
 *
 *   - Event Details and Template always show (every goal benefits from
 *     both — Template even shapes the AI Image prompt's palette).
 *   - Timeline and Gallery show if "slideshow" or "website" was picked
 *     (Slideshow is built from their photos either way).
 *   - Invitation Card (AI Image) shows if "invitation_card" or
 *     "website" was picked.
 *   - Slideshow shows if "slideshow" or "website" was picked.
 *   - Review always runs last, but its own page.tsx branches its
 *     content: the paid account/payment flow only if "website" was
 *     picked, otherwise a light, free "here's what you made, download
 *     it" screen with no account required at all.
 *
 * A draft with no goals chosen yet (mid-wizard, before reaching the
 * Goals step) resolves to the full step list, so nav/sidebar don't look
 * broken before a choice has been made. "Memories" was explicitly
 * dropped from the whole wizard (guest-facing moderation queue doesn't
 * apply to a not-yet-live draft).
 */
export type WizardGoal = "invitation_card" | "slideshow" | "website";

export const WIZARD_GOAL_OPTIONS: { value: WizardGoal; label: string; description: string }[] = [
  { value: "invitation_card", label: "Invitation Card", description: "An AI-generated invitation image" },
  { value: "slideshow", label: "Slideshow Video", description: "A music-backed video from your photos" },
  { value: "website", label: "Full Web Page", description: "A complete shareable event site" },
];

/**
 * Pre-selects the Goals step (features/start/goals-picker.tsx) based on
 * whatever Occasion the host picked one step earlier — a plain
 * heuristic guess, not a rule: every checkbox stays fully editable, so
 * a wrong guess costs one extra tap, not a dead end. Exists purely to
 * cut taps for the common case (most hosts want everything for a
 * birthday/wedding/anniversary/retirement; a workshop/education/
 * corporate/live-stream host is far less likely to want a music-video
 * slideshow of photos). Keyed by EventCategory rather than living in
 * lib/event-category.ts, since WizardGoal is owned here — see that
 * file's WISH_COPY_BY_CATEGORY for the same per-category-default
 * pattern applied to a different field.
 */
export const DEFAULT_GOALS_BY_CATEGORY: Record<EventCategory, WizardGoal[]> = {
  birthday: ["website", "slideshow", "invitation_card"],
  wedding: ["website", "slideshow", "invitation_card"],
  anniversary: ["website", "slideshow", "invitation_card"],
  retirement: ["website", "slideshow", "invitation_card"],
  baby_shower: ["website", "invitation_card"],
  obituary: ["website", "slideshow"],
  corporate: ["website"],
  workshop: ["website"],
  education: ["website"],
  live_stream: ["website"],
};

export function getDefaultGoalsForCategory(
  category: import("@/types/event").EventCategory | null | undefined,
): WizardGoal[] {
  if (!category) return [];
  return DEFAULT_GOALS_BY_CATEGORY[category] ?? [];
}

export interface WizardStep {
  slug: string;
  label: string;
  description: string;
  /** Short, encouraging tips shown in the step sidebar (WizardStepShell) — see features/start/wizard-sidebar.tsx. */
  tips: string[];
  /**
   * True for steps that add optional content and can be safely skipped
   * without leaving the wizard in a broken state — Invitation Card,
   * Timeline, Gallery, Slideshow. These get a visible "Skip for now"
   * link (features/start/skip-step-link.tsx) and a "Skip OK" badge in
   * WizardSidebar's step list, so a host in a hurry can tell at a
   * glance which steps they can come back to later. Occasion, Goals,
   * Event Details, Template, and Review are NOT optional — everything
   * downstream depends on them, so they're left unmarked.
   */
  optional?: boolean;
}

/**
 * Deliberately not typed as Record<string, WizardStep> — that would
 * make every lookup return `WizardStep | undefined` under
 * noUncheckedIndexedAccess. Keeping this as a plain literal-keyed
 * object lets TypeScript know exactly which keys exist, so
 * STEP_REGISTRY.basics etc. is always a real WizardStep below.
 */
const STEP_REGISTRY = {
  occasion: {
    slug: "occasion",
    label: "Occasion",
    description: "What are you celebrating?",
    tips: ["Pick whichever is closest — you can fine-tune the wording and details on the next steps."],
  },
  goals: {
    slug: "goals",
    label: "What to Build",
    description: "Pick one, two, or all three",
    tips: [
      "Not sure yet? Pick everything — you can always come back and add more before you're done.",
      "Just want a quick invitation card or video? You won't need an account or payment at all for those.",
    ],
  },
  basics: {
    slug: "basics",
    label: "Event Details",
    description: "Who, what, when, where",
    tips: [
      "Everything here feeds the rest of the wizard — your AI invitation prompt, the public page, even the WhatsApp message you'll eventually send guests.",
      "Not sure about the exact time yet? You can always change it later — nothing here is locked in.",
    ],
  },
  timeline: {
    slug: "timeline",
    label: "Timeline",
    description: "Add life milestones",
    tips: [
      "A handful of milestones goes a long way — 4 or 5 well-chosen moments usually read better than a long list.",
      "Add a photo to a milestone and it becomes eligible for your Slideshow automatically.",
    ],
    optional: true,
  },
  gallery: {
    slug: "gallery",
    label: "Gallery",
    description: "Upload photos",
    tips: [
      "Sort photos into categories now — guests browse the Gallery by category on the live site.",
      "Higher-resolution photos look sharper both in the Gallery and if you use them in your Slideshow.",
    ],
    optional: true,
  },
  template: {
    slug: "template",
    label: "Template",
    description: "Pick a look",
    tips: [
      "Every template shares the same sections — you're only changing colors, fonts, and motion, so switching later won't lose any content.",
      "The template you pick here also shapes the AI Image step's suggested color palette.",
    ],
  },
  "ai-image": {
    slug: "ai-image",
    label: "Invitation Card",
    description: "Optional — generate an AI invitation image",
    tips: [
      "Be specific — mention colors, motifs, and mood for a noticeably better result than a generic description.",
      "You can download the generated image immediately, even if you don't save it as your Link Preview Image or continue further.",
      "Save it as your Link Preview Image and it automatically becomes the first slide in your Slideshow, too.",
    ],
    optional: true,
  },
  slideshow: {
    slug: "slideshow",
    label: "Slideshow",
    description: "Turn photos into a video",
    tips: [
      "Add background music for a noticeably more polished result — most phone/piano recordings work fine.",
      "You can re-render as many times as your plan allows, so it's fine to experiment with pacing and photo order.",
    ],
    optional: true,
  },
  review: {
    slug: "review",
    label: "Review",
    description: "See what you've built",
    tips: [
      "This is the real result, exactly as it'll look — worth checking on your phone too.",
      "Creating an account doesn't charge you anything by itself — payment is a separate step after, and only applies if you're keeping a full website.",
    ],
  },
};

/** Computes the actual step list for a draft based on its chosen goals — see this file's top doc comment for the exact rules. */
export function resolveWizardSteps(goals: string[] | null | undefined): WizardStep[] {
  const steps: WizardStep[] = [STEP_REGISTRY.occasion, STEP_REGISTRY.goals];

  const hasGoals = Array.isArray(goals) && goals.length > 0;
  const wantsWebsite = !hasGoals || goals!.includes("website");
  const wantsCard = !hasGoals || goals!.includes("invitation_card");
  const wantsSlideshow = !hasGoals || goals!.includes("slideshow");

  steps.push(STEP_REGISTRY.basics);
  if (wantsWebsite || wantsSlideshow) steps.push(STEP_REGISTRY.timeline, STEP_REGISTRY.gallery);
  steps.push(STEP_REGISTRY.template);
  if (wantsWebsite || wantsCard) steps.push(STEP_REGISTRY["ai-image"]);
  if (wantsWebsite || wantsSlideshow) steps.push(STEP_REGISTRY.slideshow);
  steps.push(STEP_REGISTRY.review);

  return steps;
}

export function wizardStepHref(token: string, slug: string): string {
  return `/start/${token}/${slug}`;
}

export function nextWizardStep(slug: string, goals?: string[] | null): WizardStep | null {
  const steps = resolveWizardSteps(goals);
  const i = steps.findIndex((s) => s.slug === slug);
  if (i === -1 || i === steps.length - 1) return null;
  return steps[i + 1] ?? null;
}

export function prevWizardStep(slug: string, goals?: string[] | null): WizardStep | null {
  const steps = resolveWizardSteps(goals);
  const i = steps.findIndex((s) => s.slug === slug);
  if (i <= 0) return null;
  return steps[i - 1] ?? null;
}

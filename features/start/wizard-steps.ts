/**
 * Single source of truth for the self-serve onboarding wizard's step
 * order — see app/start/[token]/layout.tsx (nav) and each step's
 * page.tsx (prev/next links).
 *
 * Order: Event Details -> Timeline -> Gallery -> Template -> Slideshow
 * -> Invitation Card (AI Image) -> Review. Event Details deliberately
 * comes first so the AI Image step's default prompt is built from real
 * honoree name / occasion / venue / template instead of placeholders —
 * and AI Image is pushed to the end and made skippable (see its
 * page.tsx's "Skip for now" link) since it's the one step with a real
 * per-image API cost, so nobody should feel forced through it just to
 * see the rest of what they've built. "Memories" was explicitly dropped
 * (guest-facing moderation queue doesn't apply to a not-yet-live draft).
 */
export interface WizardStep {
  slug: string;
  label: string;
  description: string;
}

export const WIZARD_STEPS: WizardStep[] = [
  { slug: "basics", label: "Event Details", description: "Who, what, when, where" },
  { slug: "timeline", label: "Timeline", description: "Add life milestones" },
  { slug: "gallery", label: "Gallery", description: "Upload photos" },
  { slug: "template", label: "Template", description: "Pick a look" },
  { slug: "slideshow", label: "Slideshow", description: "Turn photos into a video" },
  { slug: "ai-image", label: "Invitation Card", description: "Optional — generate an AI invitation image" },
  { slug: "review", label: "Review", description: "Preview & create your account" },
];

export function wizardStepHref(token: string, slug: string): string {
  return `/start/${token}/${slug}`;
}

export function nextWizardStep(slug: string): WizardStep | null {
  const i = WIZARD_STEPS.findIndex((s) => s.slug === slug);
  if (i === -1 || i === WIZARD_STEPS.length - 1) return null;
  return WIZARD_STEPS[i + 1] ?? null;
}

export function prevWizardStep(slug: string): WizardStep | null {
  const i = WIZARD_STEPS.findIndex((s) => s.slug === slug);
  if (i <= 0) return null;
  return WIZARD_STEPS[i - 1] ?? null;
}

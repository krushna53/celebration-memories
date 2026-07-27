/**
 * Single source of truth for the self-serve onboarding wizard's step
 * order — see app/start/[token]/layout.tsx (nav) and each step's
 * page.tsx (prev/next links). Order follows the user's original spec:
 * AI Image -> Timeline -> Gallery -> Event Settings -> Template ->
 * Slideshow -> Review. "Memories" was explicitly dropped (guest-facing
 * moderation queue doesn't apply to a not-yet-live draft).
 */
export interface WizardStep {
  slug: string;
  label: string;
  description: string;
}

export const WIZARD_STEPS: WizardStep[] = [
  { slug: "ai-image", label: "Invitation Card", description: "Generate an AI invitation image" },
  { slug: "timeline", label: "Timeline", description: "Add life milestones" },
  { slug: "gallery", label: "Gallery", description: "Upload photos" },
  { slug: "basics", label: "Event Details", description: "Who, what, when, where" },
  { slug: "template", label: "Template", description: "Pick a look" },
  { slug: "slideshow", label: "Slideshow", description: "Turn photos into a video" },
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

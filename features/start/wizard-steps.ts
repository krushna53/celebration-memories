/**
 * Single source of truth for the self-serve onboarding wizard's step
 * order — see app/start/[token]/layout.tsx (nav) and each step's
 * page.tsx (prev/next links).
 *
 * Order: Event Details -> Timeline -> Gallery -> Template -> Invitation
 * Card (AI Image) -> Slideshow -> Review. Event Details deliberately
 * comes first so the AI Image step's default prompt is built from real
 * honoree name / occasion / venue / template instead of placeholders.
 * AI Image sits late and is skippable (see its page.tsx's "Skip for
 * now" link) since it's the one step with a real per-image API cost —
 * but it comes right *before* Slideshow, not after, because when a
 * host has saved a generated image as their Link Preview Image
 * (event.shareImagePath), the Slideshow step automatically leads with
 * it as the first slide (see app/start/[token]/slideshow/page.tsx) —
 * that only works smoothly first-time-through if AI Image already ran.
 * "Memories" was explicitly dropped (guest-facing moderation queue
 * doesn't apply to a not-yet-live draft).
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
  { slug: "ai-image", label: "Invitation Card", description: "Optional — generate an AI invitation image" },
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

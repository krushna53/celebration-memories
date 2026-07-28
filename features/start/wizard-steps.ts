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
  /** Short, encouraging tips shown in the step sidebar (WizardStepShell) — see features/start/wizard-sidebar.tsx. */
  tips: string[];
}

export const WIZARD_STEPS: WizardStep[] = [
  {
    slug: "basics",
    label: "Event Details",
    description: "Who, what, when, where",
    tips: [
      "Everything here feeds the rest of the wizard — your AI invitation prompt, the public page, even the WhatsApp message you'll eventually send guests.",
      "Not sure about the exact time yet? You can always change it later — nothing here is locked in.",
    ],
  },
  {
    slug: "timeline",
    label: "Timeline",
    description: "Add life milestones",
    tips: [
      "A handful of milestones goes a long way — 4 or 5 well-chosen moments usually read better than a long list.",
      "Add a photo to a milestone and it becomes eligible for your Slideshow automatically.",
    ],
  },
  {
    slug: "gallery",
    label: "Gallery",
    description: "Upload photos",
    tips: [
      "Sort photos into categories now — guests browse the Gallery by category on the live site.",
      "Higher-resolution photos look sharper both in the Gallery and if you use them in your Slideshow.",
    ],
  },
  {
    slug: "template",
    label: "Template",
    description: "Pick a look",
    tips: [
      "Every template shares the same sections — you're only changing colors, fonts, and motion, so switching later won't lose any content.",
      "The template you pick here also shapes the AI Image step's suggested color palette.",
    ],
  },
  {
    slug: "ai-image",
    label: "Invitation Card",
    description: "Optional — generate an AI invitation image",
    tips: [
      "Be specific — mention colors, motifs, and mood for a noticeably better result than a generic description.",
      "You can download the generated image immediately, even if you don't save it as your Link Preview Image or continue further.",
      "Save it as your Link Preview Image and it automatically becomes the first slide in your Slideshow, too.",
    ],
  },
  {
    slug: "slideshow",
    label: "Slideshow",
    description: "Turn photos into a video",
    tips: [
      "Add background music for a noticeably more polished result — most phone/piano recordings work fine.",
      "You can re-render as many times as your plan allows, so it's fine to experiment with pacing and photo order.",
    ],
  },
  {
    slug: "review",
    label: "Review",
    description: "Preview & create your account",
    tips: [
      "This is the real public page, exactly as guests will see it — worth opening on your phone too.",
      "Creating an account doesn't charge you anything by itself — payment is a separate step after.",
    ],
  },
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

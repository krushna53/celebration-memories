import Link from "next/link";
import { SkipForward } from "lucide-react";

import { nextWizardStep, wizardStepHref } from "@/features/start/wizard-steps";

/**
 * "Skip for now" link rendered as a WizardStepShell `headerAction` on
 * every optional step (Invitation Card, Timeline, Gallery, Slideshow —
 * see WizardStep.optional in wizard-steps.ts). Deliberately more
 * visible than a plain text link — a dashed pill with an icon — since
 * the whole point is a host in a hurry notices at a glance that this
 * step is safe to defer, without it competing with the step's real
 * call to action (still far quieter than the gold "Next" button).
 */
export function SkipStepLink({
  token,
  slug,
  goals,
}: {
  token: string;
  slug: string;
  goals?: string[] | null;
}) {
  const next = nextWizardStep(slug, goals);
  if (!next) return null;

  return (
    <Link
      href={wizardStepHref(token, next.slug)}
      className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-gold-500/40 px-3 py-1.5 text-xs font-medium text-gold-700 transition-luxury duration-300 hover:border-gold-500 hover:bg-gold-500/5"
    >
      <SkipForward size={12} /> Skip for now
    </Link>
  );
}

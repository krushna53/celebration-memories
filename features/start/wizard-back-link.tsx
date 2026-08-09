import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { prevWizardStep, wizardStepHref } from "@/features/start/wizard-steps";

/**
 * Standalone "← Previous Step" link, styled identically to the prev
 * link inside WizardStepShell's own built-in footer (see
 * wizard-step-shell.tsx) — for the handful of steps that pass
 * `hideFooter` because they need a custom call-to-action layout
 * (Event Details' own "Save & Continue", Goals' "Continue" + "show me
 * everything", Review's highlighted "Create Account" box) but still
 * shouldn't lose prev/next-style navigation entirely. Renders nothing
 * on the very first step (Occasion), where there's nowhere to go back
 * to — safe to drop in unconditionally on any step.
 */
export function WizardBackLink({
  token,
  slug,
  goals,
  className = "",
}: {
  token: string;
  slug: string;
  goals?: string[] | null;
  className?: string;
}) {
  const prev = prevWizardStep(slug, goals);
  if (!prev) return null;

  return (
    <Link
      href={wizardStepHref(token, prev.slug)}
      className={`inline-flex items-center gap-1.5 text-sm text-navy-700/70 hover:text-navy-950 ${className}`}
    >
      <ArrowLeft size={15} /> {prev.label}
    </Link>
  );
}

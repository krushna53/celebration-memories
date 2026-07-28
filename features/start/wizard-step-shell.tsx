import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { WizardNav } from "@/features/start/wizard-nav";
import { WIZARD_STEPS, nextWizardStep, prevWizardStep, wizardStepHref } from "@/features/start/wizard-steps";

/**
 * Common chrome (step nav + heading + prev/next footer) shared by every
 * wizard step page — see app/start/[token]/*\/page.tsx. Steps aren't
 * gated in order, so "Next" is always available; it's just a shortcut
 * to the next step in WIZARD_STEPS, not a validation gate.
 */
export function WizardStepShell({
  token,
  slug,
  title,
  description,
  children,
  hideFooter = false,
  headerAction,
}: {
  token: string;
  slug: string;
  title: string;
  description: string;
  children: React.ReactNode;
  /** Set true on steps (like Event Basics) whose own form already handles "Save & Continue". */
  hideFooter?: boolean;
  /**
   * Small, deliberately understated element rendered beside the title —
   * used by the Invitation Card step for its "Skip for now" link (see
   * app/start/[token]/ai-image/page.tsx). Not styled as a button on
   * purpose: it shouldn't compete with the step's real call to action.
   */
  headerAction?: React.ReactNode;
}) {
  const prev = prevWizardStep(slug);
  const next = nextWizardStep(slug);

  return (
    <div>
      <WizardNav token={token} currentSlug={slug} />
      <div className="mx-auto max-w-4xl px-4 py-8 sm:py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl text-navy-950">{title}</h1>
            <p className="mt-1 text-sm text-navy-700/60">{description}</p>
          </div>
          {headerAction ? <div className="shrink-0 pt-1">{headerAction}</div> : null}
        </div>
        <div className="mt-6">{children}</div>

        {!hideFooter ? (
          <div className="mt-10 flex items-center justify-between border-t border-navy-950/10 pt-6">
            {prev ? (
              <Link
                href={wizardStepHref(token, prev.slug)}
                className="inline-flex items-center gap-1.5 text-sm text-navy-700/70 hover:text-navy-950"
              >
                <ArrowLeft size={15} /> {prev.label}
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link
                href={wizardStepHref(token, next.slug)}
                className="inline-flex items-center gap-1.5 rounded-full bg-gold-500 px-5 py-2.5 text-sm font-medium text-navy-950 hover:brightness-110"
              >
                {next.label} <ArrowRight size={15} />
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export { WIZARD_STEPS };

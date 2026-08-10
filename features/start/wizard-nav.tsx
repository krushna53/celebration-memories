import Link from "next/link";
import { Check, X } from "lucide-react";

import { resolveWizardSteps, wizardStepHref } from "@/features/start/wizard-steps";
import { SITE_NAME } from "@/lib/constants";

/**
 * Horizontal step indicator for the onboarding wizard. Every step is
 * clickable — there's no hard gating between steps (a draft is just a
 * database row you can edit in any order), so a host can jump ahead or
 * back freely and come back later using the same link. The step list
 * itself depends on `goals` (what the host chose on the Goals step) —
 * see resolveWizardSteps.
 *
 * Also the wizard's ONLY header — app/start/[token]/layout.tsx renders
 * no other site chrome (no logo, no way out) around any step page, so
 * a host who opened the wizard had no way back to the main site short
 * of the browser's own Back button. The brand-mark row above the step
 * pills fixes that: a small "EveryMoment" home link plus an explicit
 * "Exit" — a draft is just a saved database row keyed by `token`, so
 * leaving mid-wizard loses nothing; the same link picks up right where
 * they left off.
 */
export function WizardNav({
  token,
  currentSlug,
  goals,
}: {
  token: string;
  currentSlug: string;
  goals?: string[] | null;
}) {
  const steps = resolveWizardSteps(goals);
  const currentIndex = steps.findIndex((s) => s.slug === currentSlug);

  return (
    <nav className="border-b border-white/10 bg-navy-950">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 pt-3">
        <Link href="/" className="flex items-center gap-2 font-display text-sm tracking-wide text-gold-300">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/everymoment-logo-icon.svg" alt="" aria-hidden="true" className="h-5 w-5 shrink-0" />
          {SITE_NAME}
        </Link>
        <Link
          href="/"
          className="flex items-center gap-1 text-xs text-ivory-100/60 transition-luxury duration-200 hover:text-gold-300"
        >
          <X size={13} /> Exit
        </Link>
      </div>
      <ol className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-4 py-3 sm:gap-2">
        {steps.map((step, i) => {
          const isCurrent = step.slug === currentSlug;
          const isDone = i < currentIndex;
          return (
            <li key={step.slug} className="shrink-0">
              <Link
                href={wizardStepHref(token, step.slug)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium tracking-wide transition-luxury duration-300 ${
                  isCurrent
                    ? "bg-gold-500 text-navy-950"
                    : isDone
                      ? "text-gold-300 hover:bg-white/5"
                      : "text-ivory-100/50 hover:bg-white/5 hover:text-ivory-100/80"
                }`}
              >
                {isDone ? <Check size={12} /> : <span>{i + 1}.</span>}
                {step.label}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

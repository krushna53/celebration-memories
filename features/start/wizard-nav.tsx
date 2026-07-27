import Link from "next/link";
import { Check } from "lucide-react";

import { WIZARD_STEPS, wizardStepHref } from "@/features/start/wizard-steps";

/**
 * Horizontal step indicator for the onboarding wizard. Every step is
 * clickable — there's no hard gating between steps (a draft is just a
 * database row you can edit in any order), so a host can jump ahead or
 * back freely and come back later using the same link.
 */
export function WizardNav({ token, currentSlug }: { token: string; currentSlug: string }) {
  const currentIndex = WIZARD_STEPS.findIndex((s) => s.slug === currentSlug);

  return (
    <nav className="border-b border-white/10 bg-navy-950">
      <ol className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-4 py-3 sm:gap-2">
        {WIZARD_STEPS.map((step, i) => {
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

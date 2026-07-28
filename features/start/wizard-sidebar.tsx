import Link from "next/link";
import { Check, Lightbulb } from "lucide-react";

import { WIZARD_STEPS, wizardStepHref } from "@/features/start/wizard-steps";

/**
 * Fills the sidebar column WizardStepShell renders beside each step's
 * main content — a compact "what's ahead" outline of the whole wizard
 * plus a couple of short, step-specific tips (see each WizardStep's
 * `tips` in wizard-steps.ts). Purely informational, no state — exists
 * so a first-time host has context for what they're building toward
 * without having to guess from the top nav alone, and so the page
 * doesn't read as mostly empty space on wide screens.
 */
export function WizardSidebar({ token, currentSlug }: { token: string; currentSlug: string }) {
  const currentIndex = WIZARD_STEPS.findIndex((s) => s.slug === currentSlug);
  const current = WIZARD_STEPS[currentIndex];

  return (
    <div className="grid gap-4">
      {current && current.tips.length > 0 ? (
        <div className="rounded-xl border border-gold-500/20 bg-gold-500/5 p-4">
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.1em] text-gold-700">
            <Lightbulb size={13} /> Tips
          </div>
          <ul className="mt-2.5 grid gap-2">
            {current.tips.map((tip) => (
              <li key={tip} className="text-xs leading-relaxed text-navy-700/70">
                {tip}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-xl border border-navy-950/10 bg-white p-4">
        <div className="text-xs font-medium uppercase tracking-[0.1em] text-navy-700/50">What&rsquo;s Ahead</div>
        <ol className="mt-2.5 grid gap-2.5">
          {WIZARD_STEPS.map((step, i) => {
            const isCurrent = step.slug === currentSlug;
            const isDone = i < currentIndex;
            return (
              <li key={step.slug}>
                <Link
                  href={wizardStepHref(token, step.slug)}
                  className={`flex items-start gap-2 rounded-md ${isCurrent ? "" : "opacity-70 hover:opacity-100"}`}
                >
                  <span
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] ${
                      isCurrent
                        ? "bg-gold-500 text-navy-950"
                        : isDone
                          ? "bg-gold-500/20 text-gold-700"
                          : "bg-navy-950/5 text-navy-700/40"
                    }`}
                  >
                    {isDone ? <Check size={9} /> : i + 1}
                  </span>
                  <span>
                    <span className={`block text-xs ${isCurrent ? "font-medium text-navy-950" : "text-navy-700/70"}`}>
                      {step.label}
                    </span>
                    <span className="block text-[11px] text-navy-700/45">{step.description}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

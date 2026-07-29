import Link from "next/link";
import { Check, Lightbulb } from "lucide-react";

import { resolveWizardSteps, wizardStepHref } from "@/features/start/wizard-steps";

const RING_RADIUS = 28;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/**
 * Circular "how far through the wizard am I" indicator — steps strictly
 * before the current one count as done, same definition WizardNav and
 * the step list below already use. Shown once at the top of the
 * sidebar so it's visible without scrolling on every step.
 */
function CircularProgress({ completed, total }: { completed: number; total: number }) {
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const offset = RING_CIRCUMFERENCE * (1 - percent / 100);

  return (
    <div className="flex items-center gap-4 rounded-xl border border-navy-950/10 bg-white p-4">
      <div className="relative h-16 w-16 shrink-0">
        <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
          <circle cx="32" cy="32" r={RING_RADIUS} fill="none" stroke="currentColor" strokeWidth="6" className="text-navy-950/8" />
          <circle
            cx="32"
            cy="32"
            r={RING_RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={offset}
            className="text-gold-500 transition-all duration-500 ease-out"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-display text-sm text-navy-950">
          {percent}%
        </span>
      </div>
      <div>
        <div className="text-xs font-medium uppercase tracking-[0.1em] text-navy-700/50">Your Progress</div>
        <div className="mt-1 text-sm text-navy-950">
          Step {Math.min(completed + 1, total)} of {total}
        </div>
      </div>
    </div>
  );
}

/**
 * Fills the sidebar column WizardStepShell renders beside each step's
 * main content — a compact "what's ahead" outline of the whole wizard
 * plus a couple of short, step-specific tips (see each WizardStep's
 * `tips` in wizard-steps.ts). Purely informational, no state — exists
 * so a first-time host has context for what they're building toward
 * without having to guess from the top nav alone, and so the page
 * doesn't read as mostly empty space on wide screens.
 */
export function WizardSidebar({
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
  const current = steps[currentIndex];

  return (
    <div className="grid gap-4">
      <CircularProgress completed={Math.max(currentIndex, 0)} total={steps.length} />

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
          {steps.map((step, i) => {
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
                    <span className="flex items-center gap-1.5">
                      <span className={`block text-xs ${isCurrent ? "font-medium text-navy-950" : "text-navy-700/70"}`}>
                        {step.label}
                      </span>
                      {step.optional ? (
                        <span className="rounded-full border border-dashed border-gold-500/40 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-gold-700">
                          Skip OK
                        </span>
                      ) : null}
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

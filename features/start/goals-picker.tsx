"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Film, Globe, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { WIZARD_GOAL_OPTIONS, resolveWizardSteps, wizardStepHref, type WizardGoal } from "@/features/start/wizard-steps";
import type { DraftUpdateEventAction } from "@/features/start/event-basics-form";

const ICONS: Record<WizardGoal, React.ComponentType<{ size?: number }>> = {
  invitation_card: Sparkles,
  slideshow: Film,
  website: Globe,
};

export function GoalsPicker({
  token,
  eventId,
  currentGoals,
  updateAction,
}: {
  token: string;
  eventId: string;
  currentGoals: string[] | null;
  updateAction: DraftUpdateEventAction;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<WizardGoal[]>((currentGoals as WizardGoal[] | null) ?? []);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(value: WizardGoal) {
    setSelected((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  function proceed(goals: WizardGoal[]) {
    setError(null);
    startTransition(async () => {
      const result = await updateAction(token, eventId, { wizardGoals: goals });
      if (!result.success) {
        setError(result.error);
        return;
      }
      const steps = resolveWizardSteps(goals);
      const firstContentStep = steps[2]; // steps[0] = occasion, steps[1] = goals
      router.push(wizardStepHref(token, firstContentStep?.slug ?? "review"));
    });
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        {WIZARD_GOAL_OPTIONS.map((opt) => {
          const Icon = ICONS[opt.value];
          const isSelected = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              disabled={pending}
              onClick={() => toggle(opt.value)}
              className={`flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-luxury duration-300 disabled:cursor-wait ${
                isSelected ? "border-gold-500 bg-gold-500/5" : "border-navy-950/10 hover:border-gold-500/40"
              }`}
            >
              <div className="flex w-full items-center justify-between">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full ${
                    isSelected ? "bg-gold-500 text-navy-950" : "bg-navy-950/5 text-navy-700/60"
                  }`}
                >
                  <Icon size={16} />
                </span>
                {isSelected ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gold-500 text-navy-950">
                    <Check size={12} />
                  </span>
                ) : null}
              </div>
              <span className="font-medium text-navy-950">{opt.label}</span>
              <span className="text-xs text-navy-700/60">{opt.description}</span>
            </button>
          );
        })}
      </div>

      {error ? (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button disabled={pending || selected.length === 0} onClick={() => proceed(selected)}>
          {pending ? <Loader2 className="animate-spin" size={16} /> : "Continue"}
        </Button>
        <button
          type="button"
          disabled={pending}
          onClick={() => proceed(WIZARD_GOAL_OPTIONS.map((o) => o.value))}
          className="text-sm text-navy-700/50 underline underline-offset-4 hover:text-navy-700/80"
        >
          Not sure — show me everything
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Award,
  Baby,
  Briefcase,
  Cake,
  Flower2,
  GraduationCap,
  Heart,
  HeartHandshake,
  Loader2,
  Presentation,
  Radio,
} from "lucide-react";

import { EVENT_CATEGORY_OPTIONS } from "@/lib/event-category";
import { wizardStepHref } from "@/features/start/wizard-steps";
import type { EventRecord } from "@/types/event";
import type { DraftUpdateEventAction } from "@/features/start/event-basics-form";

const ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  birthday: Cake,
  wedding: Heart,
  anniversary: HeartHandshake,
  retirement: Award,
  baby_shower: Baby,
  corporate: Briefcase,
  obituary: Flower2,
  workshop: Presentation,
  education: GraduationCap,
  live_stream: Radio,
};

export function OccasionPicker({
  token,
  eventId,
  currentCategory,
  updateAction,
}: {
  token: string;
  eventId: string;
  currentCategory: EventRecord["category"];
  updateAction: DraftUpdateEventAction;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(currentCategory);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function choose(value: EventRecord["category"]) {
    if (pending) return;
    setSelected(value);
    setError(null);
    startTransition(async () => {
      const result = await updateAction(token, eventId, { category: value });
      if (result.success) {
        router.push(wizardStepHref(token, "goals"));
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {EVENT_CATEGORY_OPTIONS.map((opt) => {
          const Icon = ICONS[opt.value] ?? Cake;
          const isSelected = opt.value === selected;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={pending}
              onClick={() => choose(opt.value)}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-luxury duration-300 disabled:cursor-wait ${
                isSelected ? "border-gold-500 bg-gold-500/5" : "border-navy-950/10 hover:border-gold-500/40"
              }`}
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-full ${
                  isSelected ? "bg-gold-500 text-navy-950" : "bg-navy-950/5 text-navy-700/60"
                }`}
              >
                {isSelected && pending ? <Loader2 size={18} className="animate-spin" /> : <Icon size={18} />}
              </span>
              <span className="text-xs font-medium text-navy-950">{opt.label}</span>
            </button>
          );
        })}
      </div>
      {error ? (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

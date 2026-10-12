"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Award,
  Baby,
  Briefcase,
  Building2,
  Cake,
  Flower2,
  GraduationCap,
  Heart,
  HeartHandshake,
  Loader2,
  Mic,
  Mountain,
  Presentation,
  Radio,
  Rocket,
  Trophy,
  Users,
  UsersRound,
} from "lucide-react";

import {
  SEGMENT_COPY,
  SEGMENT_OCCASIONS,
  findSelectedOccasion,
  getEventSegment,
  occasionSelectionPatch,
  type EventSegment,
  type OccasionOption,
} from "@/lib/event-segment";
import { wizardStepHref } from "@/features/start/wizard-steps";
import type { EventRecord } from "@/types/event";
import type { DraftUpdateEventAction } from "@/features/start/event-basics-form";

const ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  birthday: Cake,
  wedding: Heart,
  anniversary: HeartHandshake,
  retirement: Award,
  baby_shower: Baby,
  obituary: Flower2,
  education: GraduationCap,
  live_stream: Radio,
  reunion: Users,
  conference: Mic,
  offsite: Mountain,
  annual_day: Building2,
  awards: Trophy,
  product_launch: Rocket,
  team_building: UsersRound,
  workshop: Presentation,
  corporate: Briefcase,
};

const SEGMENT_ICONS: Record<EventSegment, React.ComponentType<{ size?: number }>> = {
  family: Heart,
  corporate: Briefcase,
};

export function OccasionPicker({
  token,
  eventId,
  currentCategory,
  currentOccasion,
  currentGalleryChapterTitles,
  updateAction,
}: {
  token: string;
  eventId: string;
  currentCategory: EventRecord["category"];
  currentOccasion: string | null;
  currentGalleryChapterTitles: Record<string, string> | null;
  updateAction: DraftUpdateEventAction;
}) {
  const router = useRouter();
  const [segment, setSegment] = useState<EventSegment>(getEventSegment(currentCategory));
  const [selectedId, setSelectedId] = useState(findSelectedOccasion(currentCategory, currentOccasion)?.id);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function choose(option: OccasionOption) {
    if (pending) return;
    setSelectedId(option.id);
    setError(null);
    const patch = occasionSelectionPatch(option, {
      occasion: currentOccasion,
      galleryChapterTitles: currentGalleryChapterTitles,
    });
    startTransition(async () => {
      const result = await updateAction(token, eventId, patch);
      if (result.success) {
        router.push(wizardStepHref(token, "goals"));
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div>
      <div role="radiogroup" aria-label="Type of event" className="grid gap-3 sm:grid-cols-2">
        {(Object.keys(SEGMENT_COPY) as EventSegment[]).map((key) => {
          const Icon = SEGMENT_ICONS[key];
          const active = key === segment;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={pending}
              onClick={() => setSegment(key)}
              className={`flex items-center gap-4 rounded-2xl border-2 p-5 text-left transition-luxury duration-300 disabled:cursor-wait ${
                active ? "border-gold-500 bg-gold-500/5" : "border-navy-950/10 hover:border-gold-500/40"
              }`}
            >
              <span
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
                  active ? "bg-gold-500 text-navy-950" : "bg-navy-950/5 text-navy-700/60"
                }`}
              >
                <Icon size={20} />
              </span>
              <span>
                <span className="block font-display text-lg text-navy-950">{SEGMENT_COPY[key].label}</span>
                <span className="mt-0.5 block text-xs text-navy-700/70">{SEGMENT_COPY[key].tagline}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {SEGMENT_OCCASIONS[segment].map((opt) => {
          const Icon = ICONS[opt.id] ?? Cake;
          const isSelected = opt.id === selectedId;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={pending}
              onClick={() => choose(opt)}
              aria-pressed={isSelected}
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

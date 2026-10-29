"use client";

import { useFormStatus } from "react-dom";
import { Briefcase, Heart, Loader2 } from "lucide-react";

import { SEGMENT_COPY, type EventSegment } from "@/lib/event-segment";

const SEGMENT_CHOICES: { segment: EventSegment; icon: typeof Heart }[] = [
  { segment: "family", icon: Heart },
  { segment: "corporate", icon: Briefcase },
];

export function StartSegmentChoices() {
  const { pending, data } = useFormStatus();

  return (
    <>
      {SEGMENT_CHOICES.map(({ segment, icon: Icon }) => {
        const isProcessing = pending && data?.get("segment") === segment;

        return (
          <button
            key={segment}
            type="submit"
            name="segment"
            value={segment}
            disabled={pending}
            aria-busy={isProcessing}
            className="group flex items-start gap-4 rounded-2xl text-left border border-gold-500/25 bg-ivory-50/5 p-5 transition-luxury duration-300 hover:border-gold-400 hover:bg-gold-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400 disabled:cursor-wait"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold-500/15 text-gold-300 group-hover:bg-gold-500 group-hover:text-navy-950">
              {isProcessing ? <Loader2 size={20} className="animate-spin" aria-hidden="true" /> : <Icon size={20} />}
            </span>
            <span>
              <span className="block font-display text-lg text-ivory-50">{SEGMENT_COPY[segment].label}</span>
              <span className="mt-1 block text-xs leading-relaxed text-ivory-100/60">
                {SEGMENT_COPY[segment].tagline}
              </span>
            </span>
          </button>
        );
      })}
      <p role="status" className="text-center text-sm text-gold-300 empty:hidden sm:col-span-2">
        {pending ? "Creating your event…" : ""}
      </p>
    </>
  );
}

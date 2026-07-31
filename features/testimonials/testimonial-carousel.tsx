"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";

import { cn } from "@/lib/utils";
import { StarRatingDisplay } from "@/features/testimonials/star-rating";
import type { Testimonial } from "@/types/testimonial";

const AUTOPLAY_MS = 6000;

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Homepage "What Our Hosts Say" carousel — photo on the left, quote +
 * star rating + name on the right, matching the two-column layout
 * requested for the section just below the hero. Auto-advances every
 * few seconds and pauses passively (the interval just restarts) on
 * manual navigation; a set of dot indicators doubles as direct-jump
 * controls. Falls back to a gold initials avatar when no photo was
 * attached to the submission.
 */
export function TestimonialCarousel({ testimonials }: { testimonials: Testimonial[] }) {
  const [index, setIndex] = useState(0);
  const count = testimonials.length;

  useEffect(() => {
    if (count <= 1) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [count, index]);

  if (count === 0) return null;

  const current = testimonials[index];

  function go(next: number) {
    setIndex(((next % count) + count) % count);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="relative overflow-hidden rounded-2xl border border-gold-500/15 bg-white shadow-sm">
        <div className="grid gap-0 sm:grid-cols-[220px_1fr]">
          <div className="relative flex aspect-square items-center justify-center bg-navy-950 sm:aspect-auto">
            {current.photoUrl ? (
              <Image
                src={current.photoUrl}
                alt={current.name}
                fill
                className="object-cover"
                sizes="220px"
              />
            ) : (
              <span className="font-display text-4xl text-gold-300">{initials(current.name)}</span>
            )}
          </div>

          <div className="flex flex-col justify-center gap-4 p-6 sm:p-9">
            <Quote className="text-gold-500/30" size={28} />
            <p className="text-base leading-relaxed text-navy-950 sm:text-lg">&ldquo;{current.message}&rdquo;</p>
            <div>
              <StarRatingDisplay rating={current.rating} />
              <p className="mt-2 text-sm font-medium text-navy-950">
                {current.name}
                {current.role ? <span className="font-normal text-navy-700/60"> · {current.role}</span> : null}
              </p>
            </div>
          </div>
        </div>

        {count > 1 ? (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label="Previous testimonial"
              className="tap-target absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-navy-950 shadow hover:bg-white sm:left-3"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label="Next testimonial"
              className="tap-target absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-navy-950 shadow hover:bg-white sm:right-3"
            >
              <ChevronRight size={16} />
            </button>
          </>
        ) : null}
      </div>

      {count > 1 ? (
        <div className="mt-4 flex items-center justify-center gap-2">
          {testimonials.map((t, i) => (
            <button
              key={t.id}
              type="button"
              onClick={() => go(i)}
              aria-label={`Show testimonial from ${t.name}`}
              className={cn(
                "h-2 rounded-full transition-luxury duration-200",
                i === index ? "w-6 bg-gold-500" : "w-2 bg-navy-950/15 hover:bg-navy-950/30",
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

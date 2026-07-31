"use client";

import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

/** Read-only star display — the homepage carousel's rating line. */
export function StarRatingDisplay({ rating, size = 15 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          className={n <= rating ? "fill-gold-500 text-gold-500" : "fill-transparent text-navy-950/15"}
        />
      ))}
    </div>
  );
}

/** Interactive 1-5 star picker for the "Share Your Experience" form. */
export function StarRatingInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          onClick={() => onChange(n)}
          className="tap-target p-0.5"
        >
          <Star
            size={26}
            className={cn(
              "transition-luxury duration-150",
              n <= value ? "fill-gold-500 text-gold-500" : "fill-transparent text-navy-950/20 hover:text-gold-400",
            )}
          />
        </button>
      ))}
    </div>
  );
}

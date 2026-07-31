"use client";

import { useState } from "react";
import { Loader2, Star, CheckCircle2 } from "lucide-react";

import { submitReviewAction } from "@/features/business/actions";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

export function ReviewForm({ businessId }: { businessId: string }) {
  const [reviewerName, setReviewerName] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await submitReviewAction(businessId, { reviewerName, rating, comment });
    setSubmitting(false);
    if (result.success) {
      setSent(true);
    } else {
      setError(result.error);
    }
  }

  if (sent) {
    return (
      <div className="rounded-xl border border-gold-500/20 bg-gold-500/5 p-5 text-center">
        <CheckCircle2 className="mx-auto text-gold-600" size={22} />
        <p className="mt-2 text-sm font-medium text-navy-950">Thanks for your review!</p>
        <p className="mt-1 text-xs text-navy-700/60">It&rsquo;ll appear once approved.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-2.5 rounded-xl border border-navy-950/10 bg-white p-5">
      <p className="font-display text-base text-navy-950">Leave a review</p>
      <input
        value={reviewerName}
        onChange={(e) => setReviewerName(e.target.value)}
        placeholder="Your name"
        className={inputClasses}
        required
      />
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} star${n > 1 ? "s" : ""}`}>
            <Star size={22} className={n <= rating ? "fill-gold-500 text-gold-500" : "text-navy-950/15"} />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="How was your experience? (optional)"
        rows={3}
        className={`${inputClasses} resize-none`}
      />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={submitting || !reviewerName.trim()}
        className="mt-1 flex items-center justify-center gap-1.5 rounded-full bg-gold-500 px-4 py-2.5 text-sm font-medium text-navy-950 hover:brightness-110 disabled:opacity-60"
      >
        {submitting ? <Loader2 size={14} className="animate-spin" /> : null} Submit Review
      </button>
    </form>
  );
}

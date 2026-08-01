"use client";

import { useState, useTransition } from "react";
import { Check, Star, X } from "lucide-react";

import { setReviewStatusAction } from "@/features/admin/marketplace/actions";
import type { Review } from "@/types/marketplace";

type PendingReview = Review & { businessId: string; businessName: string };

export function ReviewsModeration({ initialReviews }: { initialReviews: PendingReview[] }) {
  const [reviews, setReviews] = useState(initialReviews);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function decide(review: PendingReview, status: Review["status"]) {
    setError(null);
    setBusyId(review.id);
    startTransition(async () => {
      const result = await setReviewStatusAction(review.id, review.businessId, status);
      setBusyId(null);
      if (result.success) setReviews((prev) => prev.filter((r) => r.id !== review.id));
      else setError(result.error);
    });
  }

  return (
    <div>
      <p className="text-sm text-navy-700/60">Reviews awaiting moderation before they count toward a listing&apos;s rating.</p>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      {reviews.length === 0 ? (
        <p className="mt-4 text-sm text-navy-700/60">No pending reviews.</p>
      ) : (
        <div className="mt-4 grid gap-3">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-xl border border-navy-950/10 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-navy-950">
                    {r.reviewerName} <span className="font-normal text-navy-700/50">on</span> {r.businessName}
                  </p>
                  <div className="mt-1 flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} size={12} className={n <= r.rating ? "fill-gold-500 text-gold-500" : "text-navy-950/15"} />
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={busyId === r.id}
                    onClick={() => decide(r, "approved")}
                    className="flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:brightness-110 disabled:opacity-50"
                  >
                    <Check size={12} /> Approve
                  </button>
                  <button
                    disabled={busyId === r.id}
                    onClick={() => decide(r, "rejected")}
                    className="flex items-center gap-1 rounded-full border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    <X size={12} /> Reject
                  </button>
                </div>
              </div>
              {r.comment ? <p className="mt-2 text-sm text-navy-700/80">{r.comment}</p> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

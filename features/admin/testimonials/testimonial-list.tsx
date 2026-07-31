"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Check, Loader2, Star, Trash2 } from "lucide-react";

import {
  setTestimonialApprovedAction,
  setTestimonialFeaturedAction,
  deleteTestimonialAction,
} from "@/features/testimonials/actions";
import type { Testimonial } from "@/types/testimonial";

/** Owner-only moderation queue for /admin/testimonials — approve/unapprove, feature, or delete each public submission. */
export function TestimonialList({ initialTestimonials }: { initialTestimonials: Testimonial[] }) {
  const [items, setItems] = useState(initialTestimonials);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function patch(id: string, next: Partial<Testimonial>) {
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, ...next } : t)));
  }

  function toggleApproved(item: Testimonial) {
    setError(null);
    setBusyId(item.id);
    const next = !item.approved;
    startTransition(async () => {
      const result = await setTestimonialApprovedAction(item.id, next);
      setBusyId(null);
      if (result.success) patch(item.id, { approved: next });
      else setError(result.error);
    });
  }

  function toggleFeatured(item: Testimonial) {
    setError(null);
    setBusyId(item.id);
    const next = !item.featured;
    startTransition(async () => {
      const result = await setTestimonialFeaturedAction(item.id, next);
      setBusyId(null);
      if (result.success) patch(item.id, { featured: next });
      else setError(result.error);
    });
  }

  function remove(item: Testimonial) {
    if (!confirm(`Permanently delete ${item.name}'s testimonial? This can't be undone.`)) return;
    setError(null);
    setBusyId(item.id);
    startTransition(async () => {
      const result = await deleteTestimonialAction(item.id);
      setBusyId(null);
      if (result.success) setItems((prev) => prev.filter((t) => t.id !== item.id));
      else setError(result.error);
    });
  }

  if (items.length === 0) {
    return <p className="text-sm text-navy-700/60">No testimonials submitted yet.</p>;
  }

  return (
    <div>
      {error ? (
        <p className="mb-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <div className="grid gap-4">
        {items.map((item) => (
          <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-navy-950/10 bg-white p-4 sm:flex-row sm:items-start sm:gap-4">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-navy-950/5">
              {item.photoUrl ? (
                <Image src={item.photoUrl} alt={item.name} fill className="object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-medium text-navy-700/50">
                  {item.name.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>

            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-navy-950">{item.name}</p>
                {item.role ? <span className="text-xs text-navy-700/50">{item.role}</span> : null}
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} size={12} className={n <= item.rating ? "fill-gold-500 text-gold-500" : "text-navy-950/15"} />
                  ))}
                </div>
              </div>
              <p className="mt-1.5 text-sm text-navy-700/80">{item.message}</p>
              <p className="mt-1.5 text-xs text-navy-700/40">
                {new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
              <button
                type="button"
                disabled={busyId === item.id}
                onClick={() => toggleApproved(item)}
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
                  item.approved
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-navy-950/15 text-navy-700/60 hover:border-navy-950/30"
                }`}
              >
                {busyId === item.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                {item.approved ? "Approved" : "Approve"}
              </button>
              <button
                type="button"
                disabled={busyId === item.id}
                onClick={() => toggleFeatured(item)}
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
                  item.featured
                    ? "border-gold-500/50 bg-gold-500/10 text-gold-700"
                    : "border-navy-950/15 text-navy-700/60 hover:border-navy-950/30"
                }`}
              >
                <Star size={12} className={item.featured ? "fill-gold-500" : ""} />
                {item.featured ? "Featured" : "Feature"}
              </button>
              <button
                type="button"
                disabled={busyId === item.id}
                onClick={() => remove(item)}
                className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                <Trash2 size={12} /> Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

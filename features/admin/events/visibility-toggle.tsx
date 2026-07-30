"use client";

import { useState, useTransition } from "react";
import { Globe, Loader2, Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import { toggleEventVisibilityAction } from "@/features/admin/events/actions";

interface VisibilityToggleProps {
  eventId: string;
  visibility: "public" | "private";
  /** "compact" (icon + short label, for a table row) vs "full" (icon + long label + helper text, for /admin/simple). Defaults to "compact". */
  variant?: "compact" | "full";
}

/**
 * One-click public/private switch — reused on the owner's All Events
 * list (each row) and the client's /admin/simple card, instead of
 * requiring a trip into the full Event Settings form just to flip this
 * one field. Optimistic: flips immediately, then reconciles with the
 * server's response (reverting on error) rather than waiting on a round
 * trip before showing any change.
 */
export function VisibilityToggle({ eventId, visibility, variant = "compact" }: VisibilityToggleProps) {
  const [current, setCurrent] = useState(visibility);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = current === "public" ? "private" : "public";
    setError(null);
    setCurrent(next);
    startTransition(async () => {
      const result = await toggleEventVisibilityAction(eventId, next);
      if (!result.success) {
        setCurrent(current);
        setError(result.error);
      }
    });
  }

  const isPublic = current === "public";

  if (variant === "full") {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-navy-950/10 bg-white p-4">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full",
              isPublic ? "bg-gold-500/15 text-gold-700" : "bg-navy-950/8 text-navy-700/60",
            )}
          >
            {isPublic ? <Globe size={16} /> : <Lock size={16} />}
          </span>
          <div>
            <p className="text-sm font-medium text-navy-950">{isPublic ? "Public" : "Private"}</p>
            <p className="text-xs text-navy-700/50">
              {isPublic ? "Listed on the public /events directory" : "Link only — not listed publicly"}
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isPublic}
          onClick={toggle}
          disabled={pending}
          className={cn(
            "tap-target relative h-7 w-12 shrink-0 rounded-full transition-luxury duration-200 disabled:opacity-60",
            isPublic ? "bg-gold-500" : "bg-navy-950/15",
          )}
        >
          <span
            className={cn(
              "absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-luxury duration-200",
              isPublic ? "left-6" : "left-1",
            )}
          />
        </button>
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      title={isPublic ? "Public — click to make private" : "Private — click to make public"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-luxury duration-200 disabled:opacity-60",
        isPublic
          ? "border-gold-500/40 bg-gold-500/10 text-gold-700 hover:border-gold-500"
          : "border-navy-950/15 text-navy-700/60 hover:border-navy-950/30",
      )}
    >
      {pending ? <Loader2 size={12} className="animate-spin" /> : isPublic ? <Globe size={12} /> : <Lock size={12} />}
      {isPublic ? "Public" : "Private"}
    </button>
  );
}

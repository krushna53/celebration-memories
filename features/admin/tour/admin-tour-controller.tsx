"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Compass, X } from "lucide-react";

import { markTourSeenAction } from "@/features/admin/tour/actions";

export interface TourStep {
  href: string;
  title: string;
  description: string;
}

interface AdminTourControllerProps {
  steps: TourStep[];
  /** True when this admin has never dismissed the tour before — auto-plays once on mount. */
  autoStart: boolean;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 8;

/**
 * Spotlight-style walkthrough over the admin nav pills (see
 * app/admin/(dashboard)/layout.tsx, which tags each nav <Link> with
 * data-tour-id={href}). One step per feature the signed-in admin's
 * role can actually see — the `steps` prop is already pre-filtered by
 * role by the layout, so this component doesn't need to know about
 * roles at all.
 *
 * Auto-plays once per admin (admins.has_seen_tour, see
 * features/admin/tour/actions.ts) and can be replayed anytime via the
 * "Take the Tour" button this component also renders.
 */
export function AdminTourController({ steps, autoStart }: AdminTourControllerProps) {
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const startedAuto = useRef(false);

  const measure = useCallback(() => {
    const step = steps[stepIndex];
    if (!step) return;
    const el = document.querySelector<HTMLElement>(`[data-tour-id="${step.href}"]`);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({
      top: r.top - PADDING,
      left: r.left - PADDING,
      width: r.width + PADDING * 2,
      height: r.height + PADDING * 2,
    });
  }, [stepIndex, steps]);

  useEffect(() => {
    if (autoStart && !startedAuto.current && steps.length > 0) {
      startedAuto.current = true;
      setOpen(true);
    }
    // Only ever auto-starts once per mount — replays are triggered manually via startTour().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return;

    const step = steps[stepIndex];
    const el = step ? document.querySelector<HTMLElement>(`[data-tour-id="${step.href}"]`) : null;
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });

    measure();
    const t = setTimeout(measure, 350); // re-measure once the smooth scroll above has settled
    nextButtonRef.current?.focus();

    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measure);
    };
  }, [open, stepIndex, measure, steps]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") back();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stepIndex]);

  function startTour() {
    setStepIndex(0);
    setOpen(true);
  }

  function next() {
    if (stepIndex < steps.length - 1) {
      setStepIndex((i) => i + 1);
    } else {
      finish();
    }
  }

  function back() {
    setStepIndex((i) => Math.max(0, i - 1));
  }

  function finish() {
    setOpen(false);
    if (autoStart) {
      void markTourSeenAction();
    }
  }

  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  // Tooltip position: below the target by default, flipped above if there's not enough room.
  const tooltipBelow = rect ? rect.top + rect.height + 240 < window.innerHeight : true;

  if (steps.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={startTour}
        className="tap-target flex items-center gap-1.5 text-sm text-ivory-100/70 hover:text-gold-300"
      >
        <Compass size={16} /> Take the Tour
      </button>

      {open && step && rect ? (
        <div className="fixed inset-0 z-[999]" role="presentation">
          {/* Spotlight: dims everything except the target rect via a giant box-shadow. */}
          <div
            className="pointer-events-none fixed rounded-lg border-2 border-gold-400 shadow-[0_0_0_9999px_rgba(10,15,30,0.65)] transition-all duration-300 ease-out"
            style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-live="polite"
            className="fixed w-[min(360px,calc(100vw-2rem))] rounded-xl border border-navy-950/10 bg-white p-5 shadow-2xl transition-all duration-300 ease-out"
            style={{
              left: Math.min(Math.max(rect.left, 16), window.innerWidth - 376),
              top: tooltipBelow ? rect.top + rect.height + 12 : undefined,
              bottom: tooltipBelow ? undefined : window.innerHeight - rect.top + 12,
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-base text-navy-950">{step.title}</h2>
              <button
                type="button"
                onClick={finish}
                aria-label="Close tour"
                className="shrink-0 text-navy-700/40 hover:text-navy-700/70"
              >
                <X size={16} />
              </button>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-navy-700/80">{step.description}</p>

            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-navy-700/40">
                Step {stepIndex + 1} of {steps.length}
              </span>
              <div className="flex items-center gap-2">
                {stepIndex > 0 ? (
                  <button
                    type="button"
                    onClick={back}
                    className="flex items-center gap-1 rounded-lg border border-navy-950/15 px-3 py-1.5 text-xs font-medium text-navy-700/70 hover:border-navy-950/30"
                  >
                    <ArrowLeft size={13} /> Back
                  </button>
                ) : null}
                <button
                  ref={nextButtonRef}
                  type="button"
                  onClick={next}
                  className="flex items-center gap-1 rounded-lg bg-navy-950 px-3 py-1.5 text-xs font-medium text-ivory-100 hover:bg-navy-900"
                >
                  {isLast ? "Finish" : "Next"} {isLast ? null : <ArrowRight size={13} />}
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={finish}
              className="mt-3 text-xs text-navy-700/40 underline underline-offset-2 hover:text-navy-700/60"
            >
              Skip tour
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

"use client";

import type { ReactNode } from "react";
import { motion, type Easing } from "framer-motion";

import { useTemplateAnimation } from "@/templates/shared/template-animation-context";

interface RevealProps {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}

interface RevealTiming {
  duration: number;
  ease: Easing | Easing[];
  y: number;
}

/**
 * Per-template motion personality for scroll-reveal entrances. "luxury"
 * (the default, used outside any template too) keeps the original slow
 * fade-and-rise; livelier personalities get shorter durations and a bit
 * more overshoot, still nowhere near bouncy-cartoon territory unless the
 * template is explicitly "jubilant" (full celebration mode).
 */
const TIMINGS: Record<string, RevealTiming> = {
  luxury: { duration: 0.8, ease: [0.22, 1, 0.36, 1], y: 28 },
  minimal: { duration: 0.7, ease: [0.22, 1, 0.36, 1], y: 20 },
  dreamy: { duration: 1.0, ease: [0.16, 1, 0.3, 1], y: 32 },
  playful: { duration: 0.55, ease: [0.34, 1.56, 0.64, 1], y: 24 },
  energetic: { duration: 0.45, ease: [0.34, 1.56, 0.64, 1], y: 20 },
  festive: { duration: 0.6, ease: [0.34, 1.56, 0.64, 1], y: 26 },
  jubilant: { duration: 0.5, ease: [0.34, 1.75, 0.64, 1], y: 22 },
};

/**
 * Shared scroll-reveal wrapper. Timing adapts to the active template's
 * animation personality (see templates/shared/template-animation-context.tsx)
 * — every section below the fold uses this for a consistent entrance
 * feel within one template, from restrained (luxury/minimal) to lively
 * (festive/jubilant).
 */
export function Reveal({ children, delay = 0, y, className }: RevealProps) {
  const personality = useTemplateAnimation();
  const timing = TIMINGS[personality] ?? TIMINGS.luxury!;

  return (
    <motion.div
      initial={{ opacity: 0, y: y ?? timing.y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: timing.duration, delay, ease: timing.ease }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

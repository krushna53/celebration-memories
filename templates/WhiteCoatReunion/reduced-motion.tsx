"use client";

import type { ReactNode } from "react";
import { MotionConfig } from "framer-motion";

/** Makes the shared Framer Motion reveals (components/motion/reveal.tsx) honour the visitor's prefers-reduced-motion setting inside this template. */
export function RespectReducedMotion({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

"use client";

import { createContext, useContext } from "react";

import type { TemplateTheme } from "@/lib/templates";

type TemplateAnimation = TemplateTheme["animation"];

/**
 * Defaults to "luxury" (the platform's original restrained timing) so
 * anything rendered outside a template — e.g. the /invite/[token] page,
 * which uses Reveal but isn't wrapped in TemplateThemeWrapper — behaves
 * exactly as before. Only components inside a template's tree see a
 * different personality.
 */
const TemplateAnimationContext = createContext<TemplateAnimation>("luxury");

export const TemplateAnimationProvider = TemplateAnimationContext.Provider;

export function useTemplateAnimation(): TemplateAnimation {
  return useContext(TemplateAnimationContext);
}

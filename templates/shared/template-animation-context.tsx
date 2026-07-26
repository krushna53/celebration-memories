"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { TemplateAnimationPersonality } from "@/lib/template-catalog";

type TemplateAnimation = TemplateAnimationPersonality;

/**
 * Defaults to "luxury" (the platform's original restrained timing) so
 * anything rendered outside a template — e.g. the /invite/[token] page,
 * which uses Reveal but isn't wrapped in TemplateThemeWrapper — behaves
 * exactly as before. Only components inside a template's tree see a
 * different personality.
 */
const TemplateAnimationContext = createContext<TemplateAnimation>("luxury");

interface TemplateAnimationProviderProps {
  value: TemplateAnimation;
  children: ReactNode;
}

/**
 * Deliberately a real named function component wrapping
 * TemplateAnimationContext.Provider, rather than re-exporting
 * `TemplateAnimationContext.Provider` directly. Next.js's documented
 * pattern for rendering third-party context providers from a Server
 * Component (see TemplateThemeWrapper, which is a Server Component)
 * requires the provider to be an ordinary Client Component — exporting
 * the raw Provider element type crosses the server/client boundary as a
 * special React internal type rather than a plain function, which
 * produced a production-only "Element type is invalid ... resolves to:
 * Context" crash (React error #306) under React 19. Wrapping it here
 * fixes that.
 */
export function TemplateAnimationProvider({ value, children }: TemplateAnimationProviderProps) {
  return (
    <TemplateAnimationContext.Provider value={value}>{children}</TemplateAnimationContext.Provider>
  );
}

export function useTemplateAnimation(): TemplateAnimation {
  return useContext(TemplateAnimationContext);
}

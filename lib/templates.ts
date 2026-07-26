import dynamic from "next/dynamic";
import type { ComponentType } from "react";

import type { EventDisplayData } from "@/lib/event-display";
import type { EventRecord } from "@/types/event";
import type { GalleryPhotoRecord, TimelineMilestoneRecord } from "@/types/content";
import {
  TEMPLATE_CATALOG,
  DEFAULT_TEMPLATE_SLUG,
  type TemplateSummary,
  type TemplateAnimationPersonality,
} from "@/lib/template-catalog";

export type { TemplateSummary };
export { TEMPLATE_CATALOG, DEFAULT_TEMPLATE_SLUG };

/**
 * Per-template palette, expressed as overrides for the exact CSS custom
 * property names app/globals.css declares in `@theme` — see
 * /templates/shared/template-theme-wrapper.tsx for how these get applied.
 */
export interface TemplateTheme {
  colors: {
    navy950: string;
    navy900: string;
    navy800: string;
    navy700: string;
    navy600: string;
    gold100: string;
    gold200: string;
    gold300: string;
    gold400: string;
    gold500: string;
    gold600: string;
    ivory50: string;
    ivory100: string;
    ivory200: string;
  };
  /** Full CSS font-family value, e.g. `"var(--font-playfair), Georgia, serif"`. */
  fontDisplayVar: string;
  fontSansVar: string;
  /**
   * Named motion personality, read via useTemplateAnimation() (see
   * templates/shared/template-animation-context.tsx) by both the Reveal
   * component (scroll-entrance timing) and HeroSection (which particle
   * background renders — gold dust, confetti, or rising balloons).
   * "festive" and "jubilant" are birthday-specific: festive keeps the
   * luxury brief's restraint with a warmer/livelier touch, jubilant
   * goes full celebration (confetti bursts + floating balloons).
   */
  animation: TemplateAnimationPersonality;
}

/** Props every template component receives — identical across all templates. */
export interface BirthdayTemplateProps {
  event: EventRecord | null;
  displayData: EventDisplayData;
  galleryPhotos: GalleryPhotoRecord[];
  milestones: TimelineMilestoneRecord[];
}

export interface TemplateDefinition extends TemplateSummary {
  component: ComponentType<BirthdayTemplateProps>;
}

/**
 * TEMPLATE REGISTRY (full, server-only) — the single source of truth for
 * every template's actual rendering component. Server Components only:
 * this file's module graph pulls in every template's section tree,
 * including server-only services (Memory Wall, etc), so it must never be
 * imported from a "use client" file. Client components that just need
 * metadata (name/thumbnail/price/…) should import TEMPLATE_CATALOG from
 * /lib/template-catalog.ts instead — see /features/admin/templates/template-picker.tsx.
 *
 * To add a template: create a folder under /templates, export a
 * `{Name}Theme` from `theme.ts` and a default component from
 * `index.tsx`, add its metadata to TEMPLATE_CATALOG, then add one entry
 * below pairing the slug to its dynamically-imported component. No
 * other application code should need to change.
 */
const COMPONENTS: Record<string, ComponentType<BirthdayTemplateProps>> = {
  "royal-gold": dynamic(() => import("@/templates/RoyalGold")),
  "floral-pastel": dynamic(() => import("@/templates/FloralPastel")),
  "minimal-white": dynamic(() => import("@/templates/MinimalWhite")),
  "kids-cartoon": dynamic(() => import("@/templates/KidsCartoon")),
  "neon-party": dynamic(() => import("@/templates/NeonParty")),
  "golden-confetti": dynamic(() => import("@/templates/GoldenConfetti")),
  "balloon-pop": dynamic(() => import("@/templates/BalloonPop")),
  "milestone-elegant": dynamic(() => import("@/templates/MilestoneElegant")),
  "retro-disco": dynamic(() => import("@/templates/RetroDisco")),
  "vintage-keepsake": dynamic(() => import("@/templates/VintageKeepsake")),
};

export const ALL_TEMPLATES: TemplateDefinition[] = TEMPLATE_CATALOG.map((summary) => ({
  ...summary,
  component: COMPONENTS[summary.slug]!,
}));

export function getTemplateBySlug(slug: string | null | undefined): TemplateDefinition {
  return (
    ALL_TEMPLATES.find((t) => t.slug === slug) ??
    ALL_TEMPLATES.find((t) => t.slug === DEFAULT_TEMPLATE_SLUG) ??
    ALL_TEMPLATES[0]!
  );
}

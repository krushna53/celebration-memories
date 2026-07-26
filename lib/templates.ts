import dynamic from "next/dynamic";
import { createElement, type ComponentType } from "react";

import type { EventDisplayData } from "@/lib/event-display";
import type { EventRecord } from "@/types/event";
import type { GalleryPhotoRecord, TimelineMilestoneRecord } from "@/types/content";
import {
  TEMPLATE_CATALOG,
  DEFAULT_TEMPLATE_SLUG,
  type TemplateSummary,
  type TemplateTheme,
} from "@/lib/template-catalog";
import { communitySubmissionToTemplateSummary } from "@/lib/community-theme";
import { getTemplateSubmissionBySlug } from "@/services/template-submissions";
import type { TemplateSubmissionRecord } from "@/types/template-submission";

export type { TemplateSummary, TemplateTheme };
export { TEMPLATE_CATALOG, DEFAULT_TEMPLATE_SLUG };

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

const CommunityTemplateComponent = dynamic(() => import("@/templates/CommunityTemplate"));

function communityTemplateDefinition(submission: TemplateSubmissionRecord): TemplateDefinition {
  function Component(props: BirthdayTemplateProps) {
    return createElement(CommunityTemplateComponent, { submission, ...props });
  }

  // communitySubmissionToTemplateSummary also includes a `designer` field
  // (for the admin picker's credit display) that TemplateDefinition
  // doesn't declare — harmless excess property, nothing here reads it.
  return { ...communitySubmissionToTemplateSummary(submission), component: Component };
}

/**
 * Community-aware template resolution — checks the built-in registry
 * first (fast, synchronous path every existing call site still uses via
 * getTemplateBySlug), and only falls back to a Supabase lookup for an
 * approved community submission if the slug isn't a built-in. Used by
 * the actual public page renderer (features/event-landing/event-landing
 * -page.tsx); the two admin tool pages (AI Image, Share Image) that also
 * call getTemplateBySlug just read accent-color metadata for their own
 * UI and stay on the synchronous built-in-only path for now — if an
 * event is on a community template those two tools currently show the
 * default template's colors, a known, minor limitation.
 */
export async function resolveTemplate(slug: string | null | undefined): Promise<TemplateDefinition> {
  const builtIn = ALL_TEMPLATES.find((t) => t.slug === slug);
  if (builtIn) return builtIn;

  if (slug) {
    const submission = await getTemplateSubmissionBySlug(slug);
    if (submission) return communityTemplateDefinition(submission);
  }

  return getTemplateBySlug(slug);
}

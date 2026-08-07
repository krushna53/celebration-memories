import type { EventCategory } from "@/types/event";

/**
 * Pure template metadata — no component imports, no server-only code
 * anywhere in this file's module graph. This is what client components
 * (like the admin template picker) import, so their bundle never pulls
 * in server-only services through a template's rendering component.
 * See /lib/templates.ts for the full registry (metadata + component),
 * which only Server Components should import.
 */
/**
 * Motion personality names, shared between the server-only template
 * registry (lib/templates.ts, via TemplateTheme.animation) and client
 * components that need the type without pulling in server-only code
 * (templates/shared/template-animation-context.tsx). Kept here rather
 * than in lib/templates.ts specifically so "use client" files never need
 * to import from that server-only module.
 */
export type TemplateAnimationPersonality =
  | "luxury"
  | "playful"
  | "energetic"
  | "dreamy"
  | "minimal"
  | "festive"
  | "jubilant";

/**
 * Per-template palette, expressed as overrides for the exact CSS custom
 * property names app/globals.css declares in `@theme` — see
 * /templates/shared/template-theme-wrapper.tsx for how these get applied.
 * Deliberately declared here (client-safe) rather than in the
 * server-only lib/templates.ts, since client components — including the
 * public template-submission form's live preview and
 * lib/community-theme.ts — need this shape without pulling in server-only
 * code. lib/templates.ts re-exports this type for existing imports.
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
   */
  animation: TemplateAnimationPersonality;
}

export interface TemplateSummary {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: "general" | "kids" | "formal" | "festive" | "romantic" | "baby" | "corporate" | "memorial";
  premium: boolean;
  /** INR. Only meaningful when `premium` is true. */
  price?: number;
  thumbnail: string;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  /**
   * Occasions this template was designed for — used by the wizard's
   * Template step (app/start/[token]/template/page.tsx) to surface a
   * "Recommended for your <occasion>" group first. Purely a sorting/
   * labeling hint: every template still works for any occasion, and
   * templates without this field (the original ten) are treated as
   * general-purpose and shown in their normal position.
   */
  occasions?: EventCategory[];
}

export const TEMPLATE_CATALOG: TemplateSummary[] = [
  {
    id: "tpl-royal-gold",
    slug: "royal-gold",
    name: "Royal Gold",
    description: "Navy & gold, Playfair Display headings — timeless and formal.",
    category: "formal",
    premium: false,
    thumbnail: "/templates/royal-gold.svg",
    primaryColor: "#c9a227",
    secondaryColor: "#060d1a",
    fontFamily: "Playfair Display",
  },
  {
    id: "tpl-floral-pastel",
    slug: "floral-pastel",
    name: "Floral Pastel",
    description: "Blush and sage with a romantic script display face.",
    category: "romantic",
    premium: false,
    thumbnail: "/templates/floral-pastel.svg",
    primaryColor: "#c96a8c",
    secondaryColor: "#2f3e2a",
    fontFamily: "Dancing Script",
  },
  {
    id: "tpl-minimal-white",
    slug: "minimal-white",
    name: "Minimal White",
    description: "Clean monochrome with a single accent — understated and modern.",
    category: "formal",
    premium: false,
    thumbnail: "/templates/minimal-white.svg",
    primaryColor: "#1a1a1a",
    secondaryColor: "#6b6b6b",
    fontFamily: "Inter",
  },
  {
    id: "tpl-kids-cartoon",
    slug: "kids-cartoon",
    name: "Kids Cartoon",
    description: "Bright coral, turquoise and sunshine yellow with a rounded, playful face.",
    category: "kids",
    premium: true,
    price: 499,
    thumbnail: "/templates/kids-cartoon.svg",
    primaryColor: "#ff6f61",
    secondaryColor: "#2fb8ac",
    fontFamily: "Baloo 2",
  },
  {
    id: "tpl-neon-party",
    slug: "neon-party",
    name: "Neon Party",
    description: "Deep charcoal background with electric pink & cyan, bold display type.",
    category: "festive",
    premium: true,
    price: 599,
    thumbnail: "/templates/neon-party.svg",
    primaryColor: "#ff2fb8",
    secondaryColor: "#2fe0ff",
    fontFamily: "Bebas Neue",
  },
  {
    id: "tpl-golden-confetti",
    slug: "golden-confetti",
    name: "Golden Confetti",
    description: "Warm wine & amber with drifting confetti — festive, still polished. Built for birthdays.",
    category: "festive",
    premium: false,
    thumbnail: "/templates/golden-confetti.svg",
    primaryColor: "#ff9a3c",
    secondaryColor: "#2b0f1a",
    fontFamily: "Playfair Display",
  },
  {
    id: "tpl-balloon-pop",
    slug: "balloon-pop",
    name: "Balloon Pop",
    description: "Midnight purple, sunshine yellow, confetti bursts and rising balloons — full celebration mode.",
    category: "festive",
    premium: true,
    price: 499,
    thumbnail: "/templates/balloon-pop.svg",
    primaryColor: "#ffc107",
    secondaryColor: "#1a0b2e",
    fontFamily: "Baloo 2",
  },
  {
    id: "tpl-milestone-elegant",
    slug: "milestone-elegant",
    name: "Milestone Elegant",
    description: "Deep emerald & gold foil, refined Playfair Display headings — a dignified, formal look built for milestone birthdays (50th, 60th, 75th, 90th).",
    category: "formal",
    premium: true,
    price: 599,
    thumbnail: "/templates/milestone-elegant.svg",
    primaryColor: "#c9a227",
    secondaryColor: "#0a1f1a",
    fontFamily: "Playfair Display",
  },
  {
    id: "tpl-retro-disco",
    slug: "retro-disco",
    name: "Retro Disco",
    description: "Glitter gold on deep aubergine with a bold, groovy display face — a 70s/80s throwback for milestone birthdays that want to dance.",
    category: "festive",
    premium: true,
    price: 599,
    thumbnail: "/templates/retro-disco.svg",
    primaryColor: "#f4c10f",
    secondaryColor: "#170821",
    fontFamily: "Righteous",
  },
  {
    id: "tpl-vintage-keepsake",
    slug: "vintage-keepsake",
    name: "Vintage Keepsake",
    description: "Sepia tones and antique brass with an old-style serif — a nostalgic, cherished-memories feel for honoring a lifetime.",
    category: "general",
    premium: false,
    thumbnail: "/templates/vintage-keepsake.svg",
    primaryColor: "#c08a3e",
    secondaryColor: "#2e1f14",
    fontFamily: "EB Garamond",
  },
  {
    id: "tpl-ivory-blush",
    slug: "ivory-blush",
    name: "Ivory Blush",
    description: "Deep plum with rose-blush accents and a tall elegant serif — built for weddings.",
    category: "romantic",
    premium: true,
    price: 699,
    thumbnail: "/templates/ivory-blush.svg",
    primaryColor: "#c97f92",
    secondaryColor: "#2a1a22",
    fontFamily: "Cormorant Garamond",
    occasions: ["wedding", "anniversary"],
  },
  {
    id: "tpl-emerald-vow",
    slug: "emerald-vow",
    name: "Emerald Vow",
    description: "Deep emerald & gold foil, refined Playfair Display headings — built for anniversaries.",
    category: "formal",
    premium: true,
    price: 599,
    thumbnail: "/templates/emerald-vow.svg",
    primaryColor: "#c9a227",
    secondaryColor: "#04140f",
    fontFamily: "Playfair Display",
    occasions: ["anniversary", "wedding"],
  },
  {
    id: "tpl-little-blessings",
    slug: "little-blessings",
    name: "Little Blessings",
    description: "Dusty blue and soft apricot with a gentle rounded display face — built for baby showers.",
    category: "baby",
    premium: false,
    thumbnail: "/templates/little-blessings.svg",
    primaryColor: "#e88f68",
    secondaryColor: "#2c3e4a",
    fontFamily: "Quicksand",
    occasions: ["baby_shower"],
  },
  {
    id: "tpl-corporate-slate",
    slug: "corporate-slate",
    name: "Corporate Slate",
    description: "Slate navy and steel-blue with clean grotesk type — built for corporate events, workshops, and livestreams.",
    category: "corporate",
    premium: true,
    price: 399,
    thumbnail: "/templates/corporate-slate.svg",
    primaryColor: "#5b7ea8",
    secondaryColor: "#0b1220",
    fontFamily: "Inter",
    occasions: ["corporate", "workshop", "education", "live_stream"],
  },
  {
    id: "tpl-golden-farewell",
    slug: "golden-farewell",
    name: "Golden Farewell",
    description: "Warm bronze and gold with dignified Playfair Display headings — built for retirement celebrations.",
    category: "formal",
    premium: false,
    thumbnail: "/templates/golden-farewell.svg",
    primaryColor: "#c2903a",
    secondaryColor: "#1c130a",
    fontFamily: "Playfair Display",
    occasions: ["retirement"],
  },
  {
    id: "tpl-in-loving-memory",
    slug: "in-loving-memory",
    name: "In Loving Memory",
    description: "Soft charcoal and muted sand with a quiet antique serif — a respectful, understated memorial tribute.",
    category: "memorial",
    premium: false,
    thumbnail: "/templates/in-loving-memory.svg",
    primaryColor: "#ad9367",
    secondaryColor: "#1b1c1e",
    fontFamily: "EB Garamond",
    occasions: ["obituary"],
  },
  {
    id: "tpl-bright-beginnings",
    slug: "bright-beginnings",
    name: "Bright Beginnings",
    description: "Deep teal and warm amber with friendly, energetic type — built for workshops and educational events.",
    category: "general",
    premium: false,
    thumbnail: "/templates/bright-beginnings.svg",
    primaryColor: "#ff8533",
    secondaryColor: "#062626",
    fontFamily: "Poppins",
    occasions: ["workshop", "education"],
  },
  {
    id: "tpl-live-signal",
    slug: "live-signal",
    name: "Live Signal",
    description: "Deep indigo with electric violet accents and clean grotesk type — built for livestreamed and corporate events.",
    category: "corporate",
    premium: true,
    price: 399,
    thumbnail: "/templates/live-signal.svg",
    primaryColor: "#7c5cf0",
    secondaryColor: "#0d0a2b",
    fontFamily: "Inter",
    occasions: ["live_stream", "corporate"],
  },
  {
    id: "tpl-eternal-rest",
    slug: "eternal-rest",
    name: "Eternal Rest",
    description: "Deep forest green and champagne gold with an elegant tall-waisted serif — a second, more verdant memorial tribute option.",
    category: "memorial",
    premium: false,
    thumbnail: "/templates/eternal-rest.svg",
    primaryColor: "#a68d4c",
    secondaryColor: "#0f1b14",
    fontFamily: "Cormorant Garamond",
    occasions: ["obituary"],
  },
  {
    id: "tpl-candlelight-tribute",
    slug: "candlelight-tribute",
    name: "Candlelight Tribute",
    description: "Warm espresso brown and soft rose-gold with classic Playfair Display headings — a candlelit, glowing memorial tribute.",
    category: "memorial",
    premium: false,
    thumbnail: "/templates/candlelight-tribute.svg",
    primaryColor: "#b3765a",
    secondaryColor: "#1f1712",
    fontFamily: "Playfair Display",
    occasions: ["obituary"],
  },
  {
    id: "tpl-boardroom-ivory",
    slug: "boardroom-ivory",
    name: "Boardroom Ivory",
    description: "Crisp graphite and warm bronze with clean grotesk type — a formal boardroom look for corporate events and workshops.",
    category: "corporate",
    premium: true,
    price: 399,
    thumbnail: "/templates/boardroom-ivory.svg",
    primaryColor: "#a67c48",
    secondaryColor: "#14161a",
    fontFamily: "Inter",
    occasions: ["corporate", "workshop", "education"],
  },
  {
    id: "tpl-momentum",
    slug: "momentum",
    name: "Momentum",
    description: "Deep plum-charcoal and coral-terracotta with energetic grotesk type — a livelier option for product launches, team events, and workshops.",
    category: "corporate",
    premium: true,
    price: 399,
    thumbnail: "/templates/momentum.svg",
    primaryColor: "#e05a35",
    secondaryColor: "#1a0f1a",
    fontFamily: "Inter",
    occasions: ["corporate", "workshop", "live_stream"],
  },
];

export const DEFAULT_TEMPLATE_SLUG = "royal-gold";

export function getTemplateSummaryBySlug(slug: string | null | undefined): TemplateSummary {
  return (
    TEMPLATE_CATALOG.find((t) => t.slug === slug) ??
    TEMPLATE_CATALOG.find((t) => t.slug === DEFAULT_TEMPLATE_SLUG) ??
    TEMPLATE_CATALOG[0]!
  );
}

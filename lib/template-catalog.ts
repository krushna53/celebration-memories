/**
 * Pure template metadata — no component imports, no server-only code
 * anywhere in this file's module graph. This is what client components
 * (like the admin template picker) import, so their bundle never pulls
 * in server-only services through a template's rendering component.
 * See /lib/templates.ts for the full registry (metadata + component),
 * which only Server Components should import.
 */
export interface TemplateSummary {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: "general" | "kids" | "formal" | "festive" | "romantic";
  premium: boolean;
  /** INR. Only meaningful when `premium` is true. */
  price?: number;
  thumbnail: string;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
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
];

export const DEFAULT_TEMPLATE_SLUG = "royal-gold";

export function getTemplateSummaryBySlug(slug: string | null | undefined): TemplateSummary {
  return (
    TEMPLATE_CATALOG.find((t) => t.slug === slug) ??
    TEMPLATE_CATALOG.find((t) => t.slug === DEFAULT_TEMPLATE_SLUG) ??
    TEMPLATE_CATALOG[0]!
  );
}

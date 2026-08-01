/**
 * One-shot generator for the ten new occasion templates (wedding,
 * anniversary, birthday, baby shower, retirement) added in the
 * "template catalog expansion" pass. Writes each template's theme.ts,
 * index.tsx, and public thumbnail SVG from the data table below —
 * TEMPLATE_CATALOG and lib/templates.ts entries are edited by hand
 * (they're order-sensitive, human-curated files). Safe to re-run;
 * overwrites its own generated files only.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const FONTS = {
  playfair: { display: 'var(--font-playfair), Georgia, serif', label: "Playfair Display" },
  cormorant: { display: 'var(--font-cormorant-garamond), Georgia, serif', label: "Cormorant Garamond" },
  baloo2: { display: 'var(--font-baloo2), "Comic Sans MS", sans-serif', label: "Baloo 2" },
  quicksand: { display: 'var(--font-quicksand), "Helvetica Neue", Arial, sans-serif', label: "Quicksand" },
  poppins: { display: 'var(--font-poppins), "Helvetica Neue", Arial, sans-serif', label: "Poppins" },
  inter: { display: 'var(--font-inter), "Helvetica Neue", Arial, sans-serif', label: "Inter" },
};
const SANS = {
  poppins: 'var(--font-poppins), "Helvetica Neue", Arial, sans-serif',
  quicksand: 'var(--font-quicksand), "Helvetica Neue", Arial, sans-serif',
  inter: 'var(--font-inter), "Helvetica Neue", Arial, sans-serif',
};

const TEMPLATES = [
  {
    slug: "marigold-mandap",
    componentName: "MarigoldMandap",
    name: "Marigold Mandap",
    comment: "Deep maroon & marigold — a festive Indian wedding palette.",
    darks: ["#2b0a0e", "#3a0f14", "#4d151b", "#661c24", "#802530"],
    accents: ["#ffedcc", "#ffd999", "#ffc266", "#f7a63d", "#f0931e", "#cc7714"],
    ivories: ["#fffaf2", "#fdf3e3", "#f8e8cd"],
    font: "playfair",
    sans: "poppins",
    animation: "festive",
    tagline: "Maroon & Marigold",
  },
  {
    slug: "midnight-rose",
    componentName: "MidnightRose",
    name: "Midnight Rose",
    comment: "Charcoal-plum with deep rose — a dramatic, romantic evening wedding look.",
    darks: ["#16070d", "#200a12", "#2c0e19", "#3b1322", "#4d1a2d"],
    accents: ["#fadade", "#f4b3bc", "#e9808f", "#d95a6d", "#c73a50", "#a02c40"],
    ivories: ["#fdf8f7", "#f9efed", "#f2dfdb"],
    font: "cormorant",
    sans: "poppins",
    animation: "dreamy",
    tagline: "Charcoal & Rose",
  },
  {
    slug: "sage-ivory",
    componentName: "SageIvory",
    name: "Sage & Ivory",
    comment: "Soft sage and ivory — a fresh garden-wedding feel.",
    darks: ["#1c2419", "#252f21", "#303d2b", "#3e4f38", "#4e6346"],
    accents: ["#eef2e4", "#dbe4c8", "#c0d0a4", "#a3b985", "#87a066", "#6b8350"],
    ivories: ["#fdfdf8", "#f8f8ee", "#efefdc"],
    font: "cormorant",
    sans: "quicksand",
    animation: "dreamy",
    tagline: "Sage & Ivory",
  },
  {
    slug: "silver-jubilee",
    componentName: "SilverJubilee",
    name: "Silver Jubilee",
    comment: "Midnight blue & platinum silver — built for 25th anniversaries.",
    darks: ["#0a0f1e", "#101729", "#172038", "#1f2b4a", "#2a395e"],
    accents: ["#f4f6f8", "#e3e8ee", "#c9d2dc", "#aab7c4", "#96a7b8", "#76889a"],
    ivories: ["#fbfcfd", "#f3f5f7", "#e6eaee"],
    font: "playfair",
    sans: "inter",
    animation: "luxury",
    tagline: "Midnight & Silver",
  },
  {
    slug: "ruby-celebration",
    componentName: "RubyCelebration",
    name: "Ruby Celebration",
    comment: "Deep ruby & champagne gold — built for 40th anniversaries and grand milestones.",
    darks: ["#230508", "#32080c", "#420b11", "#571017", "#6e1620"],
    accents: ["#f9efd6", "#f0dda6", "#e6c87b", "#d9b158", "#cda133", "#a98424"],
    ivories: ["#fffdf7", "#fbf6ea", "#f5ead0"],
    font: "playfair",
    sans: "poppins",
    animation: "luxury",
    tagline: "Ruby & Champagne",
  },
  {
    slug: "candy-carnival",
    componentName: "CandyCarnival",
    name: "Candy Carnival",
    comment: "Berry purple with candy pink — a sugar-rush kids birthday party.",
    darks: ["#2a0a33", "#381044", "#481955", "#5b246b", "#703383"],
    accents: ["#ffe3f1", "#ffbfde", "#ff8ec4", "#fb64ab", "#f23d92", "#c92e77"],
    ivories: ["#fffafd", "#fdf1f8", "#fae0ef"],
    font: "baloo2",
    sans: "poppins",
    animation: "playful",
    tagline: "Berry & Candy Pink",
  },
  {
    slug: "starlit-sixteen",
    componentName: "StarlitSixteen",
    name: "Starlit Sixteen",
    comment: "Midnight violet with starlit lilac — made for sweet sixteens and teen birthdays.",
    darks: ["#120b2a", "#191038", "#221748", "#2d205c", "#3a2b72"],
    accents: ["#f1edfd", "#ddd3f9", "#c1aff2", "#a68ce8", "#8c6cdc", "#7052b4"],
    ivories: ["#fcfbfe", "#f6f3fc", "#ebe5f8"],
    font: "quicksand",
    sans: "poppins",
    animation: "dreamy",
    tagline: "Violet & Starlight",
  },
  {
    slug: "garden-brunch",
    componentName: "GardenBrunch",
    name: "Garden Brunch",
    comment: "Botanical green & lemon — a bright daytime garden party.",
    darks: ["#142415", "#1b301c", "#244026", "#2f5232", "#3c6740"],
    accents: ["#fdf7d8", "#faeda6", "#f5df70", "#ecd04b", "#e0bd2a", "#b8981f"],
    ivories: ["#fdfef6", "#f9fbec", "#f0f4d8"],
    font: "poppins",
    sans: "poppins",
    animation: "playful",
    tagline: "Botanical & Lemon",
  },
  {
    slug: "twinkle-star",
    componentName: "TwinkleStar",
    name: "Twinkle Star",
    comment: "Dusk lavender with baby-yellow starlight — a gentle baby-shower lullaby.",
    darks: ["#1d1a33", "#262242", "#322d55", "#403a6b", "#504a82"],
    accents: ["#fef8dd", "#fdefb4", "#fae288", "#f3d465", "#e8c247", "#c19f33"],
    ivories: ["#fefdf9", "#fbf8ef", "#f5efdc"],
    font: "quicksand",
    sans: "quicksand",
    animation: "dreamy",
    tagline: "Lavender & Starlight",
  },
  {
    slug: "sunset-voyage",
    componentName: "SunsetVoyage",
    name: "Sunset Voyage",
    comment: "Dusk teal & sunset orange — new horizons, built for retirement celebrations.",
    darks: ["#0c1f22", "#122b2f", "#19393e", "#224a50", "#2c5e65"],
    accents: ["#ffe9d6", "#ffd0ab", "#ffb076", "#fa9350", "#f07a2f", "#c76023"],
    ivories: ["#fffaf4", "#fdf2e6", "#f8e6cf"],
    font: "playfair",
    sans: "poppins",
    animation: "luxury",
    tagline: "Teal & Sunset",
  },
];

function camel(name) {
  return name.charAt(0).toLowerCase() + name.slice(1);
}

for (const t of TEMPLATES) {
  const [d950, d900, d800, d700, d600] = t.darks;
  const [g100, g200, g300, g400, g500, g600] = t.accents;
  const [i50, i100, i200] = t.ivories;
  const themeName = `${camel(t.componentName)}Theme`;

  const themeTs = `import type { TemplateTheme } from "@/lib/templates";

/** ${t.comment} */
export const ${themeName}: TemplateTheme = {
  colors: {
    navy950: "${d950}",
    navy900: "${d900}",
    navy800: "${d800}",
    navy700: "${d700}",
    navy600: "${d600}",
    gold100: "${g100}",
    gold200: "${g200}",
    gold300: "${g300}",
    gold400: "${g400}",
    gold500: "${g500}",
    gold600: "${g600}",
    ivory50: "${i50}",
    ivory100: "${i100}",
    ivory200: "${i200}",
  },
  fontDisplayVar: ${JSON.stringify(FONTS[t.font].display)},
  fontSansVar: ${JSON.stringify(SANS[t.sans])},
  animation: "${t.animation}",
};
`;

  const indexTsx = `import { SiteShell } from "@/components/layout/site-shell";
import { EventSections } from "@/features/event-landing/event-sections";
import { TemplateThemeWrapper } from "@/templates/shared/template-theme-wrapper";
import { ${themeName} } from "./theme";
import type { BirthdayTemplateProps } from "@/lib/templates";

export default function ${t.componentName}(props: BirthdayTemplateProps) {
  return (
    <TemplateThemeWrapper theme={${themeName}}>
      <SiteShell honoreeName={props.displayData.honoreeName} transparentUntilScroll>
        <EventSections
          event={props.event}
          displayData={props.displayData}
          galleryPhotos={props.galleryPhotos}
          milestones={props.milestones}
        />
      </SiteShell>
    </TemplateThemeWrapper>
  );
}
`;

  const svg = `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
  <rect width="400" height="300" fill="${d950}"/>
  <rect y="220" width="400" height="80" fill="${i50}"/>
  <line x1="150" y1="120" x2="250" y2="120" stroke="${g500}" stroke-width="2"/>
  <text x="200" y="100" font-family="Georgia, serif" font-size="15" fill="${g300}" text-anchor="middle" letter-spacing="3">HOSTED BY</text>
  <text x="200" y="150" font-family="Georgia, serif" font-size="26" fill="${i50}" text-anchor="middle">${t.name.replace(/&/g, "&amp;")}</text>
  <text x="200" y="260" font-family="Helvetica, Arial, sans-serif" font-size="13" fill="${d700}" text-anchor="middle">${t.tagline.replace(/&/g, "&amp;")} &#183; ${FONTS[t.font].label}</text>
</svg>
`;

  const dir = join(root, "templates", t.componentName);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "theme.ts"), themeTs);
  writeFileSync(join(dir, "index.tsx"), indexTsx);
  writeFileSync(join(root, "public", "templates", `${t.slug}.svg`), svg);
  console.log(`generated ${t.componentName}`);
}

console.log("done");

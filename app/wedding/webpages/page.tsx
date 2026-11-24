import type { Metadata } from "next";
import Link from "next/link";

import { SiteShell } from "@/components/layout/site-shell";
import { PLATFORM_NAV_LINKS } from "@/features/platform/platform-marketing-content";
import { SHOWCASE_SITES, STYLES, SEAL_TINTS } from "@/features/wedding-showcase/showcase-sites";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Wedding Website Designs — 20 Live Samples | EveryMoment",
  description:
    "Open 20 sample wedding websites — envelope films, silk and velvet curtains, garden doors — each with a countdown, schedule, map and RSVP. Then create your own.",
  alternates: { canonical: `${SITE_URL}/wedding/webpages` },
};

type Site = (typeof SHOWCASE_SITES)[number];
type Style = keyof typeof STYLES;

const rgb = ([r, g, b]: number[]) => `rgb(${r}, ${g}, ${b})`;

/** The colours of a sample's opening screen, for its card: [cloth / door colour, its darker shade]. */
function introColours(site: Site): [string, string] {
  const colors = site.colors as { main: string; dark: string } | undefined;
  if (colors) return [colors.main, colors.dark];
  const vars = (site.curtain ?? site.doors) as Record<string, string> | undefined;
  switch (site.style as Style) {
    case "velvet": {
      const fabric = site.fabric as { base: number[][] } | undefined;
      return fabric ? [rgb(fabric.base[1] ?? []), rgb(fabric.base[0] ?? [])] : ["#faf3e0", "#c0a87c"];
    }
    case "petals": return [vars?.["--inv-curtain"] ?? "#a8283a", vars?.["--inv-curtain-dark"] ?? "#5c1020"];
    case "monogram": return [vars?.["--inv-deep"] ?? "#1e1b4b", "#0f0d26"];
    case "sage": return ["#a3b08f", "#5f6e52"];
    case "film":
    case "seal": return ["#f3e6cc", "#c9a86a"];
    default: return [site.form.colorBackground, site.form.colorDetail];
  }
}

/** the wax seal's colour on an envelope card */
const sealColour = (site: Site) => `hsl(${(352 + (SEAL_TINTS[(site.tint ?? "red") as keyof typeof SEAL_TINTS] ?? 0)) % 360} 62% 32%)`;

/** "#a8283a" / "rgb(70, 10, 22)" → true when light text reads better on it */
function isDark(colour: string) {
  const [r = 0, g = 0, b = 0] = colour.startsWith("#")
    ? [1, 3, 5].map((i) => parseInt(colour.slice(i, i + 2), 16))
    : (colour.match(/\d+/g) ?? []).map(Number);
  return 0.299 * r + 0.587 * g + 0.114 * b < 150;
}

const GROUPS = [
  { id: "envelope", title: "Envelope openings" },
  { id: "curtain", title: "Curtain openings" },
  { id: "doors", title: "Door openings" },
  { id: "none", title: "No opening" },
];

const formatDate = (date: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${date.slice(0, 10)}T00:00:00Z`),
  );

function SiteCard({ site, n }: { site: Site; n: number }) {
  const [cloth, shade] = introColours(site);
  const f = site.form;
  const dark = isDark(cloth);
  return (
    <Link
      href={`/wedding/webpages/${site.slug}`}
      className="group flex flex-col overflow-hidden rounded-3xl border border-navy-950/10 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-navy-950"
    >
      {/* the opening screen in miniature: an envelope with its seal, two doors, or two drapes */}
      <div className="relative aspect-[4/5] overflow-hidden" style={{ background: site.group === "envelope" ? "#f5ecd9" : f.colorBackground }}>
        {site.group === "envelope" ? (
          <>
            <div className="absolute inset-x-0 top-0 h-3/5 bg-[#ebdfc4] shadow-md transition-transform duration-700 [clip-path:polygon(0_0,100%_0,50%_100%)] group-hover:-translate-y-6" />
            <span
              className="absolute left-1/2 top-[33%] z-[1] grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-xl text-[#f6dc9a] shadow-lg"
              style={{ background: sealColour(site), fontFamily: '"Great Vibes", cursive' }}
            >
              {f.groom[0]}&amp;{f.bride[0]}
            </span>
          </>
        ) : site.group === "doors" ? (
          ["left-0 group-hover:-translate-x-3/4", "right-0 group-hover:translate-x-3/4"].map((side) => (
            <div
              key={side}
              className={`absolute inset-y-0 w-1/2 border-[6px] transition-transform duration-700 ${side}`}
              style={{ background: `linear-gradient(160deg, ${cloth}, ${shade})`, borderColor: shade, boxShadow: `inset 0 0 0 3px ${f.colorAccent}` }}
            />
          ))
        ) : site.group === "curtain" ? (
          <>
            <div
              className="absolute inset-y-0 left-0 w-1/2 transition-transform duration-700 group-hover:-translate-x-3/4"
              style={{ background: `repeating-linear-gradient(90deg, ${shade} 0 6%, ${cloth} 14%, ${shade} 22%)` }}
            />
            <div
              className="absolute inset-y-0 right-0 w-1/2 transition-transform duration-700 group-hover:translate-x-3/4"
              style={{ background: `repeating-linear-gradient(270deg, ${shade} 0 6%, ${cloth} 14%, ${shade} 22%)` }}
            />
          </>
        ) : null}
        <div className={`absolute inset-0 flex flex-col items-center px-4 text-center ${site.group === "envelope" ? "justify-end pb-6" : "justify-center"}`}>
          <span
            className="rounded-2xl px-4 py-3 shadow-lg backdrop-blur-sm"
            style={{ background: dark ? "rgba(20,14,10,0.45)" : "rgba(255,251,242,0.78)", color: dark ? "#fff7e6" : f.colorAccent }}
          >
            <span className="block text-[10px] uppercase tracking-[0.3em] opacity-80">The wedding of</span>
            <span className="mt-1 block text-3xl leading-tight" style={{ fontFamily: '"Great Vibes", "Pinyon Script", cursive' }}>
              {f.groom} &amp; {f.bride}
            </span>
            <span className="mt-1 block text-xs tracking-wider opacity-80">{formatDate(f.date)}</span>
          </span>
        </div>
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-navy-950 shadow">
          #{n}
        </span>
        <span className="absolute bottom-3 right-3 flex gap-1" aria-hidden="true">
          {[f.colorAccent, f.colorButton, f.colorBackground].map((c) => (
            <i key={c} className="block h-4 w-4 rounded-full border border-white/80 shadow" style={{ background: c }} />
          ))}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-gold-600">{STYLES[site.style as Style][1]}</p>
        <h3 className="mt-1 font-display text-xl text-navy-950">{site.title}</h3>
        <p className="mt-2 flex-1 text-sm text-navy-700">{site.blurb}</p>
        <span className="mt-4 text-sm font-semibold text-navy-950 group-hover:underline">Open the website →</span>
      </div>
    </Link>
  );
}

/** Showcase of the 20 sample wedding websites (fictional couples), for visitors and the wedding exhibition. */
export default function WeddingWebpagesPage() {
  return (
    <SiteShell honoreeName="EveryMoment" navLinks={PLATFORM_NAV_LINKS} showLogin>
      <div className="bg-ivory-50 pb-24 pt-28 sm:pt-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-gold-600">Wedding websites</p>
            <h1 className="mt-3 font-display text-3xl text-navy-950 sm:text-5xl">20 designs to explore</h1>
            <p className="mt-5 text-navy-700">
              Every one is a real, working website — tap to open the envelope or part the curtains, then scroll through
              the countdown, schedule, map and RSVP. All names and venues are samples.
            </p>
          </div>

          {GROUPS.map((group) => {
            const sites = SHOWCASE_SITES.filter((s) => s.group === group.id);
            return (
              <section key={group.id} className="mt-14" aria-labelledby={`g-${group.id}`}>
                <h2 id={`g-${group.id}`} className="font-display text-2xl text-navy-950">
                  {group.title}
                </h2>
                <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                  {sites.map((site) => (
                    <SiteCard key={site.slug} site={site} n={SHOWCASE_SITES.indexOf(site) + 1} />
                  ))}
                </div>
              </section>
            );
          })}

          <div className="mt-16 rounded-3xl bg-navy-950 px-6 py-10 text-center text-ivory-50 sm:px-10">
            <h2 className="font-display text-2xl sm:text-3xl">Like one? Make it yours.</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-ivory-100/75">
              Add your names, photos, schedule and venue — your wedding website is ready in minutes.
            </p>
            <Link
              href="/wedding-websites/create"
              className="mt-6 inline-flex rounded-full bg-gold-500 px-7 py-3 font-semibold text-navy-950 transition hover:bg-gold-400"
            >
              Create your wedding website
            </Link>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}

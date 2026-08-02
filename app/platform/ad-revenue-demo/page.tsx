import { AlertTriangle } from "lucide-react";

export const metadata = {
  title: "Ad Placement Concepts (Internal) — EveryMoment",
  robots: { index: false, follow: false },
};

/**
 * Internal-only mockup for pitching ad-revenue potential to partners or
 * investors — NOT linked from any public nav, NOT shown on any real
 * client's event site, and NOT wired to any real ad network or sponsor.
 * Every "sponsor" name/logo below is an invented placeholder (no real
 * brand names or trademarked logos), since this page is meant to
 * demonstrate the *concept* of tasteful sponsor placements within the
 * existing luxury visual language, not to represent an actual deal.
 *
 * Reachable only by knowing this exact URL — add real auth/robots
 * blocking before this ever gets shared outside the team, if it needs
 * to stay private long-term.
 */
export default function AdRevenueDemoPage() {
  return (
    <div className="min-h-screen bg-ivory-50">
      <div className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm text-amber-800">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <AlertTriangle size={14} /> Internal mockup only
        </span>{" "}
        — placeholder brand names, not a live feature or real sponsor deal.
      </div>

      {/* Concept 1: hero partner strip */}
      <section className="border-b border-navy-950/10 bg-navy-950 px-4 py-3 text-center">
        <p className="text-xs tracking-wide text-ivory-100/60">
          Presented in partnership with{" "}
          <span className="font-medium text-gold-300">Aurum Fine Jewelry</span>
        </p>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-12">
        <h1 className="font-display text-3xl text-navy-950">Sponsor Placement Concepts</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-navy-700/70">
          Three tasteful ways a sponsor could appear on a client&rsquo;s event site without
          breaking the luxury feel — a thin partnership strip above the hero, a native card
          inside the Gallery grid, and a footer &ldquo;presented by&rdquo; row. All placeholder
          content below; nothing here is connected to a real ad network, and this concept
          hasn&rsquo;t been enabled on any client site.
        </p>

        {/* Concept 2: native gallery sponsor card */}
        <section className="mt-10">
          <h2 className="font-display text-xl text-navy-950">In-Gallery Native Card</h2>
          <p className="mt-1 text-sm text-navy-700/60">
            A single sponsor card blended into the photo grid, styled identically to a real
            gallery photo so it doesn&rsquo;t feel like an ad banner.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {["Childhood", "Wedding", "Family"].map((label) => (
              <div key={label} className="flex aspect-square items-center justify-center rounded-xl bg-navy-950/5 text-xs text-navy-700/30">
                {label}
              </div>
            ))}
            <div className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gold-500/40 bg-gold-500/5 p-3 text-center">
              <span className="rounded-full bg-navy-950/85 px-2 py-0.5 text-[9px] uppercase tracking-wide text-gold-300">
                Sponsored
              </span>
              <span className="text-xs font-medium text-navy-950">Velvet &amp; Vine Catering</span>
              <span className="text-[10px] text-navy-700/50">Fine catering for celebrations</span>
            </div>
          </div>
        </section>

        {/* Concept 3: footer partner logos */}
        <section className="mt-10">
          <h2 className="font-display text-xl text-navy-950">Footer &ldquo;Presented By&rdquo; Row</h2>
          <p className="mt-1 text-sm text-navy-700/60">
            A quiet row of partner names below the real footer — easy to scan past, easy to
            notice if you&rsquo;re looking.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-6 rounded-xl border border-navy-950/10 bg-white p-6">
            {["Aurum Fine Jewelry", "Velvet & Vine Catering", "Lumière Photography Studio"].map((name) => (
              <div key={name} className="flex items-center gap-2 text-navy-700/60">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-950/10 text-xs font-semibold text-navy-950">
                  {name
                    .split(" ")
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join("")}
                </div>
                <span className="text-xs">{name}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12 rounded-xl border border-navy-950/10 bg-white p-6">
          <h2 className="font-display text-xl text-navy-950">Notes for the pitch</h2>
          <p className="mt-2 text-sm leading-relaxed text-navy-700/70">
            This page is a visual reference only — it doesn&rsquo;t include real pricing,
            projected revenue, or partner commitments, since none of that exists yet. If this
            direction is worth pursuing, the next real steps would be: deciding which
            placement(s) to actually build, whether sponsors are matched per-event-category
            (e.g. jewelers/caterers for weddings) or platform-wide, and how an event host
            opts in or out.
          </p>
        </section>
      </div>
    </div>
  );
}

import type { Metadata } from "next";

import { SiteShell } from "@/components/layout/site-shell";
import { PLATFORM_NAV_LINKS } from "@/features/platform/platform-marketing-content";
import { WeddingTabs } from "@/features/wedding-showcase/WeddingTabs";
import CardGallery from "@/features/wedding-showcase/cards/CardGallery";
import { CARDS, TEMPLATE_STORE_URL } from "@/features/wedding-showcase/cards/card-templates";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: `Wedding Invitation Cards — ${CARDS.length} Designs | EveryMoment`,
  description:
    "Royal, floral, minimal, modern and regional wedding invitation cards — pick a design and personalise it with your names, date and venue.",
  alternates: { canonical: `${SITE_URL}/wedding/card` },
};

/** Gallery of wedding invitation card designs; every card opens the template store to personalise it. */
export default function WeddingCardsPage() {
  return (
    <SiteShell honoreeName="EveryMoment" navLinks={PLATFORM_NAV_LINKS} showLogin>
      <div className="bg-ivory-50 pb-24 pt-28 sm:pt-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-gold-600">Invitation cards</p>
            <h1 className="mt-3 font-display text-3xl text-navy-950 sm:text-5xl">{CARDS.length} cards to send</h1>
            <p className="mt-5 text-navy-700">
              From maroon-and-gold royal to quiet minimal — tap any card to put your own names, date and venue on it. All
              names and venues are samples.
            </p>
          </div>
          <WeddingTabs active="card" />

          <CardGallery />

          <div className="mt-16 rounded-3xl bg-navy-950 px-6 py-10 text-center text-ivory-50 sm:px-10">
            <h2 className="font-display text-2xl sm:text-3xl">Found the one?</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-ivory-100/75">
              Personalise it in minutes, then share it on WhatsApp or download it to print.
            </p>
            <a
              href={TEMPLATE_STORE_URL}
              className="mt-6 inline-flex rounded-full bg-gold-500 px-7 py-3 font-semibold text-navy-950 transition hover:bg-gold-400"
            >
              Browse all wedding templates
            </a>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}

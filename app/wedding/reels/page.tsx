import type { Metadata } from "next";

import { SiteShell } from "@/components/layout/site-shell";
import { PLATFORM_NAV_LINKS } from "@/features/platform/platform-marketing-content";
import { WeddingTabs } from "@/features/wedding-showcase/WeddingTabs";
import FeaturedReel from "@/features/wedding-showcase/reels/FeaturedReel";
import ReelGallery from "@/features/wedding-showcase/reels/ReelGallery";
import { TEMPLATE_STORE_URL } from "@/features/wedding-showcase/reels/reel-templates";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Wedding Video Reel | EveryMoment",
  description:
    "Vertical wedding reels for Instagram, WhatsApp Status and Shorts — save the date, haldi, mehendi, sangeet, love story and countdown templates. Preview them, then make your own.",
  alternates: { canonical: `${SITE_URL}/wedding/reels` },
};

/** The sample wedding reel and the animated reel templates, each opening the AI reel studio to edit or generate. */
export default function WeddingReelsPage() {
  return (
    <SiteShell honoreeName="EveryMoment" navLinks={PLATFORM_NAV_LINKS} showLogin>
      <div className="bg-ivory-50 pb-24 pt-28 sm:pt-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-gold-600">Wedding reels</p>
            <h1 className="mt-3 font-display text-3xl text-navy-950 sm:text-5xl">A reel made for sharing</h1>
            <p className="mt-5 text-navy-700">
              A vertical wedding film — envelope, ceremonies and dates — ready for Instagram and WhatsApp. Tap the video for
              sound, then make one with your own photos. Names and venues are samples.
            </p>
          </div>
          <WeddingTabs active="reels" />

          <FeaturedReel />

          <ReelGallery />

          <div className="mt-16 rounded-3xl bg-navy-950 px-6 py-10 text-center text-ivory-50 sm:px-10">
            <h2 className="font-display text-2xl sm:text-3xl">Your story, in 15 seconds.</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-ivory-100/75">
              Pick a reel, add your names, photos and song — download it ready for Instagram and WhatsApp.
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

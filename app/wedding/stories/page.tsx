import type { Metadata } from "next";

import { SiteShell } from "@/components/layout/site-shell";
import { PLATFORM_NAV_LINKS } from "@/features/platform/platform-marketing-content";
import StoryLibrary from "@/features/wedding-showcase/stories/StoryLibrary";
import { SITE_URL } from "@/lib/constants";

const title = "Love Story Video Reels | EveryMoment";
const description =
  "Watch animated love story reels made with EveryMoment, from the first meeting to the wedding day, then customise one with your own names, places and dates.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${SITE_URL}/wedding/stories` },
  openGraph: {
    title,
    description,
    images: [{ url: "/videos/stories/story-1.jpg", width: 480, height: 853, alt: "Animated love story reel" }],
    type: "website",
    url: `${SITE_URL}/wedding/stories`,
  },
  twitter: { card: "summary_large_image", images: ["/videos/stories/story-1.jpg"] },
};

/** The Stories tab of the wedding galleries: love story reels to watch, share and customise. */
export default function WeddingStoriesPage() {
  return (
    <SiteShell honoreeName="EveryMoment" navLinks={PLATFORM_NAV_LINKS} showLogin>
      <StoryLibrary />
    </SiteShell>
  );
}

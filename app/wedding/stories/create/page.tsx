import type { Metadata } from "next";

import { SiteShell } from "@/components/layout/site-shell";
import { AiVideoStudio } from "@/features/ai-video/ai-video-studio";
import { PLATFORM_NAV_LINKS } from "@/features/platform/platform-marketing-content";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Customize Your Love Story Video | EveryMoment",
  description: "Edit a love story reel with your own names, places and dates, add music and download a 9:16 video for WhatsApp and Instagram.",
  alternates: { canonical: `${SITE_URL}/wedding/stories/create` },
  openGraph: {
    title: "Customize Your Love Story Video | EveryMoment",
    description: "Turn how you met and your favourite moments together into an animated story reel.",
    images: [{ url: "/videos/stories/story-3.jpg", width: 480, height: 853, alt: "Animated love story reel" }],
    type: "website",
  },
};

/**
 * "Customize your story" from /wedding/stories lands here with ?from=<story id>: the story editor (AI video studio in
 * story mode) opens that same video with its scenes, names, places and dates ready to edit. Without ?from it starts a
 * new story from the couple's own photo.
 */
export default function CustomizeStoryPage() {
  return (
    <SiteShell honoreeName="EveryMoment" navLinks={PLATFORM_NAV_LINKS} showLogin>
      <AiVideoStudio storyOnly />
    </SiteShell>
  );
}

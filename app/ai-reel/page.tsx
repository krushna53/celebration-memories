import type { Metadata } from "next";
import { SiteShell } from "@/components/layout/site-shell";
import { PLATFORM_NAV_LINKS } from "@/features/platform/platform-marketing-content";
import { AiReelStudio } from "@/features/wedding-showcase/reels/ai-reel-studio";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "AI Reel Studio | EveryMoment",
  description: "Upload, preview and prepare a vertical wedding reel with editable ceremony lettering.",
  alternates: { canonical: `${SITE_URL}/ai-reel` },
};

export default function AiReelPage() {
  return <SiteShell honoreeName="EveryMoment" navLinks={PLATFORM_NAV_LINKS} showLogin><AiReelStudio /></SiteShell>;
}

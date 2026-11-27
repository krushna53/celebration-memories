import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SiteShell } from "@/components/layout/site-shell";
import { STORY_VIDEOS, storyPath } from "@/features/ai-video/lib/story-videos";
import { PLATFORM_NAV_LINKS } from "@/features/platform/platform-marketing-content";
import StoryLibrary from "@/features/wedding-showcase/stories/StoryLibrary";
import { SITE_URL } from "@/lib/constants";

// One page per story (/wedding/stories/story-1 … story-6), so a shared link shows that story's cover, title and
// names. A story added to features/ai-video/lib/story-videos.js gets its page on the next build.
export const dynamicParams = false;

export function generateStaticParams() {
  return STORY_VIDEOS.map((story: { id: string }) => ({ id: story.id }));
}

type Story = { id: string; title: string; couple: string; description: string; src: string; poster?: string };

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const story = (STORY_VIDEOS as Story[]).find((s) => s.id === id);
  if (!story) return {};
  const title = `${story.title} · ${story.couple} | EveryMoment`;
  const url = `${SITE_URL}${storyPath(story.id)}`;
  const images = story.poster ? [{ url: story.poster, width: 480, height: 853, alt: `${story.couple}: ${story.title}` }] : undefined;
  return {
    title,
    description: story.description,
    alternates: { canonical: url },
    openGraph: { title, description: story.description, images, type: "video.other", url, videos: [{ url: story.src, type: "video/mp4", width: 720, height: 1280 }] },
    twitter: { card: "summary_large_image", title, description: story.description, images: story.poster ? [story.poster] : undefined },
  };
}

export default async function WeddingStoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(STORY_VIDEOS as Story[]).some((s) => s.id === id)) notFound();
  return (
    <SiteShell honoreeName="EveryMoment" navLinks={PLATFORM_NAV_LINKS} showLogin>
      <StoryLibrary initialId={id} />
    </SiteShell>
  );
}

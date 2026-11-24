import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getSharedLifeStory } from "@/services/life-story";
import { BiographyView } from "@/features/life-story/biography-view";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

/** Shared biography — the token is the credential; the host can switch sharing off or reset the link any time. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const bundle = await getSharedLifeStory(token);
  if (!bundle) return { title: "Life Story", robots: { index: false, follow: false } };
  const title = bundle.story.title || bundle.story.subjectName;
  return {
    title: `${title} — A Life Story`,
    description: bundle.story.subtitle || `The life story of ${bundle.story.subjectName}.`,
    // Private family content: never indexed, even though the link is shareable.
    robots: { index: false, follow: false },
  };
}

export default async function LifeStoryPage({ params }: Props) {
  const { token } = await params;
  const bundle = await getSharedLifeStory(token);
  if (!bundle || bundle.chapters.length === 0) notFound();

  return (
    <main>
      <BiographyView bundle={bundle} />
      <footer className="bg-navy-950 px-4 py-8 text-center text-xs text-ivory-100/60">
        Made with love on{" "}
        <a href="https://everymoment.in" className="text-gold-300 underline underline-offset-2">
          EveryMoment
        </a>
      </footer>
    </main>
  );
}

"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";

import { LifeStoryActionsProvider, type LifeStoryActions } from "@/features/admin/life-story/actions-context";
import { StoryPanel } from "@/features/admin/life-story/story-panel";
import { PhotosPanel } from "@/features/admin/life-story/photos-panel";
import { ChaptersPanel } from "@/features/admin/life-story/chapters-panel";
import { wizardStepHref } from "@/features/start/wizard-steps";
import type { LifeStoryBundle } from "@/types/life-story";

/**
 * The wizard's two Biography steps — the same Life Story panels the
 * dashboard uses (/admin/life-story), wired to the draft-token actions
 * (features/start/actions/life-story.ts) through LifeStoryActionsProvider.
 * The narrated film isn't part of the wizard; it stays optional, from the
 * dashboard once the page is live.
 */

/** Step 1 — the story (pasted or a .docx) and the photos. */
export function BiographyStoryStep({ token, eventId, bundle, actions }: { token: string; eventId: string; bundle: LifeStoryBundle; actions: LifeStoryActions }) {
  const router = useRouter();
  const photosRef = useRef<HTMLDivElement>(null);
  return (
    <LifeStoryActionsProvider actions={actions}>
      <StoryPanel eventId={eventId} story={bundle.story} onDone={() => photosRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} />
      <div ref={photosRef} className="mt-10 scroll-mt-6">
        <h2 className="font-display text-xl text-navy-950">Photos</h2>
        <p className="mt-1 text-sm text-navy-700/60">Childhood to today — the AI places each one in the right chapter and on the timeline.</p>
        <div className="mt-4">
          <PhotosPanel eventId={eventId} photos={bundle.photos} coverPhotoId={bundle.story.coverPhotoId} onDone={() => router.push(wizardStepHref(token, "book"))} />
        </div>
      </div>
    </LifeStoryActionsProvider>
  );
}

/** Step 2 — the AI writes the book and the timeline; the host reads and corrects it. */
export function BiographyBookStep({
  eventId,
  bundle,
  actions,
  writesLeft,
  aiConfigured,
  bookHref,
}: {
  eventId: string;
  bundle: LifeStoryBundle;
  actions: LifeStoryActions;
  writesLeft: number;
  aiConfigured: boolean;
  bookHref: string;
}) {
  return (
    <LifeStoryActionsProvider actions={actions}>
      <ChaptersPanel key={bundle.story.structuredAt ?? "draft"} eventId={eventId} bundle={bundle} writesLeft={writesLeft} aiConfigured={aiConfigured} bookHref={bookHref} />
    </LifeStoryActionsProvider>
  );
}

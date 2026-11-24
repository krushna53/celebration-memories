import { notFound } from "next/navigation";

import { DRAFT_HONOREE_PLACEHOLDER, getDraftEventByToken } from "@/services/event-drafts";
import { getLifeStoryBundle } from "@/services/life-story";
import { WizardStepShell } from "@/features/start/wizard-step-shell";
import { BiographyBookStep } from "@/features/start/biography-steps";
import { draftLifeStoryActions } from "@/features/start/biography-actions";

export const dynamic = "force-dynamic";

/** Biography step 2 — the AI writes the book and the life timeline; everything stays editable. */
export default async function WizardBookPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const event = await getDraftEventByToken(token);
  if (!event) notFound();
  const bundle = await getLifeStoryBundle(event.id, event.honoreeName === DRAFT_HONOREE_PLACEHOLDER ? "" : event.honoreeName);

  return (
    <WizardStepShell
      token={token}
      slug="book"
      goals={event.wizardGoals}
      category={event.category}
      title="The book"
      description="The AI writes the biography like a bestseller — chapters, opening quotes, photo captions — and the life timeline for your page. Read it and fix anything it got wrong."
    >
      <BiographyBookStep
        eventId={event.id}
        bundle={bundle}
        actions={draftLifeStoryActions(token)}
        writesLeft={Math.max(0, bundle.story.structureLimit - bundle.story.structureRuns)}
        aiConfigured={Boolean(process.env.OPENAI_API_KEY)}
        bookHref={`/events/${encodeURIComponent(event.slug)}/book`}
      />
    </WizardStepShell>
  );
}

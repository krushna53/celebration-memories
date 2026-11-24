import { notFound } from "next/navigation";

import { getDraftEventByToken } from "@/services/event-drafts";
import { getLifeStoryBundle } from "@/services/life-story";
import { WizardStepShell } from "@/features/start/wizard-step-shell";
import { BiographyStoryStep } from "@/features/start/biography-steps";
import { draftLifeStoryActions } from "@/features/start/biography-actions";

export const dynamic = "force-dynamic";

/** Biography step 1 — the story and photos (see features/start/biography-steps.tsx). */
export default async function WizardStoryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const event = await getDraftEventByToken(token);
  if (!event) notFound();
  const bundle = await getLifeStoryBundle(event.id, event.honoreeName);

  return (
    <WizardStepShell
      token={token}
      slug="story"
      goals={event.wizardGoals}
      category={event.category}
      title="Their story"
      description="Paste the story or upload the Google Doc, then add photos. You don't need to write well — the AI writes the book."
    >
      <BiographyStoryStep token={token} eventId={event.id} bundle={bundle} actions={draftLifeStoryActions(token)} />
    </WizardStepShell>
  );
}

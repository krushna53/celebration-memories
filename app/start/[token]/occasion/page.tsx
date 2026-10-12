import { notFound } from "next/navigation";

import { getDraftEventByToken } from "@/services/event-drafts";
import { OccasionPicker } from "@/features/start/occasion-picker";
import { WizardStepShell } from "@/features/start/wizard-step-shell";
import { draftUpdateEventAction } from "@/features/start/actions/event";
import { getSegmentCopy } from "@/lib/event-segment";

export const dynamic = "force-dynamic";

export default async function WizardOccasionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const event = await getDraftEventByToken(token);
  if (!event) notFound();
  const copy = getSegmentCopy(event.category);

  return (
    <WizardStepShell
      token={token}
      slug="occasion"
      goals={event.wizardGoals}
      title={copy.occasionStepTitle}
      description={copy.occasionStepDescription}
      hideFooter
    >
      <OccasionPicker
        token={token}
        eventId={event.id}
        currentCategory={event.category}
        currentOccasion={event.occasion}
        currentGalleryChapterTitles={event.galleryChapterTitles}
        updateAction={draftUpdateEventAction}
      />
    </WizardStepShell>
  );
}

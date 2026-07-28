import { notFound } from "next/navigation";

import { getDraftEventByToken } from "@/services/event-drafts";
import { OccasionPicker } from "@/features/start/occasion-picker";
import { WizardStepShell } from "@/features/start/wizard-step-shell";
import { draftUpdateEventAction } from "@/features/start/actions/event";

export const dynamic = "force-dynamic";

export default async function WizardOccasionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const event = await getDraftEventByToken(token);
  if (!event) notFound();

  return (
    <WizardStepShell
      token={token}
      slug="occasion"
      goals={event.wizardGoals}
      title="What are you celebrating?"
      description="This shapes the wording and suggestions throughout the rest of the wizard."
      hideFooter
    >
      <OccasionPicker
        token={token}
        eventId={event.id}
        currentCategory={event.category}
        updateAction={draftUpdateEventAction}
      />
    </WizardStepShell>
  );
}

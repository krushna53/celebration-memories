import { notFound } from "next/navigation";

import { getDraftEventByToken } from "@/services/event-drafts";
import { GoalsPicker } from "@/features/start/goals-picker";
import { WizardStepShell } from "@/features/start/wizard-step-shell";
import { draftUpdateEventAction } from "@/features/start/actions/event";

export const dynamic = "force-dynamic";

export default async function WizardGoalsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const event = await getDraftEventByToken(token);
  if (!event) notFound();

  return (
    <WizardStepShell
      token={token}
      slug="goals"
      goals={event.wizardGoals}
      title="What would you like to build?"
      description="Pick as many as you'd like — this decides which steps you'll see next. Just want a quick invitation card or video? Those don't need an account or payment at all."
      hideFooter
    >
      <GoalsPicker
        token={token}
        eventId={event.id}
        category={event.category}
        currentGoals={event.wizardGoals}
        updateAction={draftUpdateEventAction}
      />
    </WizardStepShell>
  );
}

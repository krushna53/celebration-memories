import { notFound } from "next/navigation";

import { getDraftEventByToken } from "@/services/event-drafts";
import { EventBasicsForm } from "@/features/start/event-basics-form";
import { WizardStepShell } from "@/features/start/wizard-step-shell";
import { draftUpdateEventAction } from "@/features/start/actions/event";
import { wizardStepHref, nextWizardStep } from "@/features/start/wizard-steps";

export const dynamic = "force-dynamic";

export default async function WizardBasicsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const event = await getDraftEventByToken(token);
  if (!event) notFound();

  const next = nextWizardStep("basics");

  return (
    <WizardStepShell
      token={token}
      slug="basics"
      title="Event Details"
      description="These details appear across your public site — hero, event details, and invite pages."
      hideFooter
    >
      <EventBasicsForm
        token={token}
        event={event}
        updateAction={draftUpdateEventAction}
        nextHref={next ? wizardStepHref(token, next.slug) : undefined}
      />
    </WizardStepShell>
  );
}

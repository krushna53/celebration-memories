import { notFound } from "next/navigation";

import { getDraftEventByToken } from "@/services/event-drafts";
import { getRsvpConfig } from "@/services/rsvp-config";
import { getEventSegment } from "@/lib/event-segment";
import { WizardStepShell } from "@/features/start/wizard-step-shell";
import { SkipStepLink } from "@/features/start/skip-step-link";
import { RsvpFormBuilder } from "@/features/admin/rsvp-form/rsvp-form-builder";
import { draftGenerateRsvpConfigAction, draftSaveRsvpConfigAction } from "@/features/start/actions/rsvp-form";
import { AI_RSVP_GENERATOR_CONFIGURED } from "@/lib/ai-rsvp-config";

export const dynamic = "force-dynamic";

/** Optional wizard step: configure the RSVP form (lib/rsvp-config.ts) while building the event. */
export default async function WizardRsvpFormPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const event = await getDraftEventByToken(token);
  if (!event) notFound();
  const config = await getRsvpConfig(event.id);

  return (
    <WizardStepShell
      token={token}
      slug="rsvp-form"
      goals={event.wizardGoals}
      category={event.category}
      title="RSVP Form"
      description="Optional — choose what your RSVP form asks. Leave it as it is for the standard form."
      headerAction={<SkipStepLink token={token} slug="rsvp-form" goals={event.wizardGoals} />}
    >
      <RsvpFormBuilder
        initialConfig={config}
        corporate={getEventSegment(event.category) === "corporate"}
        saveAction={draftSaveRsvpConfigAction.bind(null, token, event.id)}
        generateAction={AI_RSVP_GENERATOR_CONFIGURED ? draftGenerateRsvpConfigAction.bind(null, token, event.id) : undefined}
      />
    </WizardStepShell>
  );
}

import { notFound, redirect } from "next/navigation";

import { WizardNav } from "@/features/start/wizard-nav";
import { resolveWizardSteps, wizardStepHref } from "@/features/start/wizard-steps";
import { designFormFor } from "@/features/sacred-garden/lib/design";
import { getDraftEventByToken } from "@/services/event-drafts";
import { RsvpTeaserSection } from "@/features/rsvp/rsvp-teaser-section";
import CreateInvitation from "@/app/wedding-websites/create/CreateInvitation";

export const dynamic = "force-dynamic";

/**
 * Weddings only: the Sacred Garden create form as a wizard step, right
 * after Event Details. Full width (form left, live website right) under
 * the step bar, so no sidebar; Save & Continue keeps the design on this
 * draft (features/sacred-garden/actions.ts) and moves to the next step.
 */
export default async function WizardDesignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const event = await getDraftEventByToken(token);
  if (!event) notFound();
  // not a wedding website (another occasion, or no "website" goal): this step isn't in the list
  if (!resolveWizardSteps(event.wizardGoals, event.category).some((step) => step.slug === "design")) {
    redirect(wizardStepHref(token, "template"));
  }

  return (
    <div>
      <WizardNav token={token} currentSlug="design" goals={event.wizardGoals} category={event.category} />
      <CreateInvitation
        draftToken={token}
        initialForm={designFormFor(event)}
        inWizard
        rsvp={
          <RsvpTeaserSection eventId={event.id} eventSlug={event.slug} publicRsvpEnabled={event.publicRsvpEnabled}
            honoreeName={event.honoreeName} category={event.category} />
        }
      />
    </div>
  );
}

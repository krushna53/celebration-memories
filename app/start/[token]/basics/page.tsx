import { notFound } from "next/navigation";

import { getDraftEventByToken } from "@/services/event-drafts";
import { EventBasicsForm } from "@/features/start/event-basics-form";
import { WizardStepShell } from "@/features/start/wizard-step-shell";
import { draftUpdateEventAction } from "@/features/start/actions/event";
import { wizardStepHref, nextWizardStep, resolveWizardSteps } from "@/features/start/wizard-steps";

export const dynamic = "force-dynamic";

export default async function WizardBasicsPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ fromCard?: string; from?: string }>;
}) {
  const { token } = await params;
  const { fromCard, from } = await searchParams;
  const event = await getDraftEventByToken(token);
  if (!event) notFound();

  // Sent here from the wedding Design step (after logging in, features/start/design-login-dialog.tsx): fill in the
  // event details, then go straight back to Design to finish it — wherever Design sits in the step order.
  const fromDesign =
    from === "design" &&
    event.category === "wedding" &&
    resolveWizardSteps(event.wizardGoals, event.category).some((step) => step.slug === "design");
  const next = fromDesign ? { slug: "design" } : nextWizardStep("basics", event.wizardGoals, event.category);

  return (
    <WizardStepShell
      token={token}
      slug="basics"
      goals={event.wizardGoals}
      category={event.category}
      title="Event Details"
      description="These details appear across your public site — hero, event details, and invite pages."
      hideFooter
    >
      {fromDesign && (
        <p
          role="status"
          className="mb-6 rounded-2xl border border-gold-500/30 bg-gold-500/10 px-4 py-3 text-sm font-medium text-navy-950"
        >
          Fill event details before you continue to complete your design.
        </p>
      )}
      <EventBasicsForm
        token={token}
        event={event}
        updateAction={draftUpdateEventAction}
        nextHref={next ? wizardStepHref(token, next.slug) : undefined}
        prefilledFromCard={fromCard === "1"}
      />
    </WizardStepShell>
  );
}

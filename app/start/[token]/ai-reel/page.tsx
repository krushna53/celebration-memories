import { notFound, redirect } from "next/navigation";

import { getDraftEventByToken } from "@/services/event-drafts";
import { resolveWizardSteps, wizardStepHref } from "@/features/start/wizard-steps";
import { WizardStepShell } from "@/features/start/wizard-step-shell";
import AiWeddingVideoStudio from "@/app/wedding-websites/create/AiWeddingVideoStudio";

export const dynamic = "force-dynamic";

/**
 * Wedding-only AI reel studio. Kept as its own wizard step directly after
 * Template and Design so it does not crowd the website-design controls.
 */
export default async function WizardAiReelPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const event = await getDraftEventByToken(token);
  if (!event) notFound();
  if (!resolveWizardSteps(event.wizardGoals, event.category).some((step) => step.slug === "ai-reel")) {
    redirect(wizardStepHref(token, "template"));
  }

  return (
    <WizardStepShell
      token={token}
      slug="ai-reel"
      goals={event.wizardGoals}
      category={event.category}
      title="Create your animated reel"
      description="Upload one couple photo and make either a wedding reel or a scene-by-scene journey video."
    >
      <AiWeddingVideoStudio />
    </WizardStepShell>
  );
}

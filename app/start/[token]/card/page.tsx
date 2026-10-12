import { notFound } from "next/navigation";

import { getDraftEventByToken } from "@/services/event-drafts";
import { publicMediaUrl } from "@/services/uploads";
import { CardUploadStep } from "@/features/start/card-upload-step";
import { WizardStepShell } from "@/features/start/wizard-step-shell";
import { draftConfirmAiImageUploadAction, draftRequestAiImageUploadUrlAction } from "@/features/start/actions/ai-image";
import { draftReadInvitationCardAction } from "@/features/start/actions/card";
import { wizardStepHref } from "@/features/start/wizard-steps";

export const dynamic = "force-dynamic";

export default async function WizardCardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const event = await getDraftEventByToken(token);
  if (!event) notFound();

  // Only a card uploaded here (or on the AI Image step's "Upload your own"
  // tab) counts as "already has a card" — an AI-generated image doesn't.
  const initialCardUrl =
    event.shareImagePath?.startsWith(`${event.id}/ai-image-upload/`) ? publicMediaUrl("gallery", event.shareImagePath) : null;

  return (
    <WizardStepShell
      token={token}
      slug="card"
      goals={event.wizardGoals}
      title={initialCardUrl ? "Your Invitation Card" : "Do you already have an invitation card?"}
      description={initialCardUrl ? "Your uploaded card is saved. Continue with it or upload a replacement." : "Upload your card and we’ll use it to fill in your event details."}
      hideFooter
    >
      <CardUploadStep
        token={token}
        eventId={event.id}
        goals={event.wizardGoals}
        initialCardUrl={initialCardUrl}
        basicsHref={wizardStepHref(token, "basics")}
        actions={{
          requestUpload: draftRequestAiImageUploadUrlAction.bind(null, token),
          recordUpload: draftConfirmAiImageUploadAction.bind(null, token),
          readCard: draftReadInvitationCardAction.bind(null, token),
        }}
      />
    </WizardStepShell>
  );
}

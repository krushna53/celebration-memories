import { notFound } from "next/navigation";

import { getDraftEventByToken } from "@/services/event-drafts";
import { getTemplateBySlug } from "@/lib/templates";
import { buildInvitationCardPrompt } from "@/lib/ai-image-prompt";
import { AI_IMAGE_CONFIGURED } from "@/lib/ai-image";
import { getLatestCompletedAiImageJob, getLatestUploadedAiImageJob } from "@/services/ai-image-jobs";
import { publicMediaUrl } from "@/services/uploads";
import { AiImageGenerator } from "@/features/admin/ai-image/ai-image-generator";
import { WizardStepShell } from "@/features/start/wizard-step-shell";
import { SkipStepLink } from "@/features/start/skip-step-link";
import {
  draftConfirmAiImageUploadAction,
  draftGenerateAiImageAction,
  draftRequestAiImageUploadUrlAction,
} from "@/features/start/actions/ai-image";
import { draftConfirmShareImageUploadAction, draftRemoveShareImageAction } from "@/features/start/actions/event";
import { draftConfirmGalleryUploadAction } from "@/features/start/actions/gallery";

export const dynamic = "force-dynamic";

export default async function WizardAiImagePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const event = await getDraftEventByToken(token);
  if (!event) notFound();

  const template = getTemplateBySlug(event.templateSlug);
  const defaultPrompt = buildInvitationCardPrompt(event, template);

  const [latestGeneratedJob, latestUploadedJob] = await Promise.all([
    getLatestCompletedAiImageJob(event.id),
    getLatestUploadedAiImageJob(event.id),
  ]);
  const initialGeneratedResult = latestGeneratedJob
    ? { url: publicMediaUrl("gallery", latestGeneratedJob.resultPath), path: latestGeneratedJob.resultPath }
    : null;
  const initialUploadedResult = latestUploadedJob
    ? { url: publicMediaUrl("gallery", latestUploadedJob.resultPath), path: latestUploadedJob.resultPath }
    : null;

  return (
    <WizardStepShell
      token={token}
      slug="ai-image"
      goals={event.wizardGoals}
      category={event.category}
      title="Invitation Card"
      description={event.shareImagePath ? "Your invitation card is saved. Continue with it, or replace it below." : "Upload your invitation card or create one with AI. This step is optional."}
      headerAction={<SkipStepLink token={token} slug="ai-image" goals={event.wizardGoals} />}
    >
      {event.shareImagePath && (
        <div className="mb-6 rounded-xl border bg-white p-4">
          <p className="mb-3 font-medium">Your saved invitation card</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={publicMediaUrl("gallery", event.shareImagePath)} alt="Saved invitation card" className="max-h-80 w-full object-contain" />
        </div>
      )}
      <details open={!event.shareImagePath}>
        <summary className="mb-4 cursor-pointer font-medium">{event.shareImagePath ? "Replace or redesign card" : "Add an invitation card"}</summary>
      <AiImageGenerator
        eventId={event.id}
        defaultPrompt={defaultPrompt}
        configured={AI_IMAGE_CONFIGURED}
        quota={null}
        initialGeneratedResult={initialGeneratedResult}
        initialUploadedResult={initialUploadedResult}
        currentShareImagePath={event.shareImagePath}
        actions={{
          generate: draftGenerateAiImageAction.bind(null, token),
          requestUpload: draftRequestAiImageUploadUrlAction.bind(null, token),
          recordUpload: draftConfirmAiImageUploadAction.bind(null, token),
          useAsShareImage: draftConfirmShareImageUploadAction.bind(null, token),
          removeShareImage: draftRemoveShareImageAction.bind(null, token),
          addToGallery: draftConfirmGalleryUploadAction.bind(null, token),
        }}
        anonAuthKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}
      />
      </details>
    </WizardStepShell>
  );
}

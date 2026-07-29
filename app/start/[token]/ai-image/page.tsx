import { notFound } from "next/navigation";

import { getDraftEventByToken } from "@/services/event-drafts";
import { getTemplateBySlug } from "@/lib/templates";
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
  const dateLabel = new Date(event.startAt).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const defaultPrompt = [
    `An elegant invitation card design for ${event.honoreeName}'s ${event.occasion || event.eventTitle}, hosted by ${event.hostedBy || "the host"}.`,
    `Held on ${dateLabel}${event.venueName ? ` at ${event.venueName}` : ""}.`,
    `Color palette inspired by ${template.name}: warm tones around ${template.primaryColor} and ${template.secondaryColor}.`,
    "No readable text in the image — just the visual design, decorative elements, and mood. Elegant, high-quality, printable invitation card style.",
  ].join(" ");

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
      title="Invitation Card"
      description="Optional — describe an image and generate it with AI to use as your invitation card and link preview image. If you save it as your Link Preview Image, it'll also lead off your Slideshow. Skip it if you'd rather not, or come back to it later."
      headerAction={<SkipStepLink token={token} slug="ai-image" goals={event.wizardGoals} />}
    >
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
    </WizardStepShell>
  );
}

import { notFound } from "next/navigation";

import { getDraftEventByToken } from "@/services/event-drafts";
import { getTemplateBySlug } from "@/lib/templates";
import { AI_IMAGE_CONFIGURED } from "@/lib/ai-image";
import { AiImageGenerator } from "@/features/admin/ai-image/ai-image-generator";
import { WizardStepShell } from "@/features/start/wizard-step-shell";
import { draftGenerateAiImageAction } from "@/features/start/actions/ai-image";
import { draftConfirmShareImageUploadAction } from "@/features/start/actions/event";
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

  return (
    <WizardStepShell
      token={token}
      slug="ai-image"
      title="Invitation Card"
      description="Describe an image and generate it with AI — this becomes your invitation card and link preview image. You can fine-tune the wording once your event details are set on the Event Details step."
    >
      <AiImageGenerator
        eventId={event.id}
        defaultPrompt={defaultPrompt}
        configured={AI_IMAGE_CONFIGURED}
        quota={null}
        actions={{
          generate: draftGenerateAiImageAction.bind(null, token),
          useAsShareImage: draftConfirmShareImageUploadAction.bind(null, token),
          addToGallery: draftConfirmGalleryUploadAction.bind(null, token),
        }}
        anonAuthKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}
      />
    </WizardStepShell>
  );
}

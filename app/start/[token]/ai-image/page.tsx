import Link from "next/link";
import { notFound } from "next/navigation";

import { getDraftEventByToken } from "@/services/event-drafts";
import { getTemplateBySlug } from "@/lib/templates";
import { AI_IMAGE_CONFIGURED } from "@/lib/ai-image";
import { AiImageGenerator } from "@/features/admin/ai-image/ai-image-generator";
import { WizardStepShell } from "@/features/start/wizard-step-shell";
import { draftGenerateAiImageAction } from "@/features/start/actions/ai-image";
import { draftConfirmShareImageUploadAction } from "@/features/start/actions/event";
import { draftConfirmGalleryUploadAction } from "@/features/start/actions/gallery";
import { nextWizardStep, wizardStepHref } from "@/features/start/wizard-steps";

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

  const next = nextWizardStep("ai-image");

  return (
    <WizardStepShell
      token={token}
      slug="ai-image"
      title="Invitation Card"
      description="Optional — describe an image and generate it with AI to use as your invitation card and link preview image. If you save it as your Link Preview Image, it'll also lead off your Slideshow. Skip it if you'd rather not, or come back to it later."
      headerAction={
        next ? (
          <Link
            href={wizardStepHref(token, next.slug)}
            className="text-xs text-navy-700/40 underline underline-offset-4 hover:text-navy-700/70"
          >
            Skip for now
          </Link>
        ) : null
      }
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

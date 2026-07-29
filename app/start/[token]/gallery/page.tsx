import { notFound } from "next/navigation";

import { getDraftEventByToken } from "@/services/event-drafts";
import { listGalleryPhotos } from "@/services/gallery-photos";
import { GalleryManager } from "@/features/admin/gallery/gallery-manager";
import { WizardStepShell } from "@/features/start/wizard-step-shell";
import { SkipStepLink } from "@/features/start/skip-step-link";
import {
  draftRequestGalleryUploadUrlAction,
  draftConfirmGalleryUploadAction,
  draftDeleteGalleryPhotoAction,
} from "@/features/start/actions/gallery";

export const dynamic = "force-dynamic";

export default async function WizardGalleryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const event = await getDraftEventByToken(token);
  if (!event) notFound();

  const photos = await listGalleryPhotos(event.id);

  return (
    <WizardStepShell
      token={token}
      slug="gallery"
      goals={event.wizardGoals}
      title="Gallery"
      description="Optional — upload the photos shown in your public Gallery section, by category."
      headerAction={<SkipStepLink token={token} slug="gallery" goals={event.wizardGoals} />}
    >
      <GalleryManager
        eventId={event.id}
        initialPhotos={photos}
        actions={{
          requestUploadUrl: draftRequestGalleryUploadUrlAction.bind(null, token),
          confirmUpload: draftConfirmGalleryUploadAction.bind(null, token),
          deletePhoto: draftDeleteGalleryPhotoAction.bind(null, token),
        }}
      />
    </WizardStepShell>
  );
}

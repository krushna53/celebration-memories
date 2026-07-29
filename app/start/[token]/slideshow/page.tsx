import { notFound } from "next/navigation";

import { getDraftEventByToken } from "@/services/event-drafts";
import { getTemplateBySlug } from "@/lib/templates";
import { listGalleryPhotos } from "@/services/gallery-photos";
import { listMilestones } from "@/services/timeline";
import { publicMediaUrl } from "@/services/uploads";
import { getLatestCompletedSlideshowVideoJob } from "@/services/slideshow-video-jobs";
import { SlideshowComposer } from "@/features/admin/slideshow/slideshow-composer";
import { WizardStepShell } from "@/features/start/wizard-step-shell";
import { SkipStepLink } from "@/features/start/skip-step-link";
import { draftStartSlideshowVideoAction, draftRequestSlideshowMusicUploadUrlAction } from "@/features/start/actions/slideshow";
import { draftConfirmShareVideoUploadAction } from "@/features/start/actions/event";
import type { SlideSource } from "@/types/content";

export const dynamic = "force-dynamic";

export default async function WizardSlideshowPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const event = await getDraftEventByToken(token);
  if (!event) notFound();

  const template = getTemplateBySlug(event.templateSlug);
  const [photos, milestones] = await Promise.all([listGalleryPhotos(event.id), listMilestones(event.id)]);

  // If an AI-generated invitation image was saved as the Link Preview
  // Image (see the Invitation Card step), lead the slideshow with it —
  // deliberately keyed off shareImagePath (the explicit "this is THE
  // invitation image" action) rather than just checking Gallery, so it
  // wins even if the host generated it after already picking Gallery
  // photos. Excluded from gallerySlides by URL below to avoid a
  // duplicate in case the host also clicked "Add to Gallery" on the
  // same image.
  const shareImageUrl = event.shareImagePath ? publicMediaUrl("gallery", event.shareImagePath) : null;
  const invitationSlide: SlideSource[] = shareImageUrl
    ? [
        {
          id: "invitation-card",
          url: shareImageUrl,
          caption: "Invitation Card",
          captionTitle: event.honoreeName,
          captionSubtitle: event.eventTitle,
        },
      ]
    : [];

  const gallerySlides: SlideSource[] = photos
    .filter((p) => p.url !== shareImageUrl)
    .map((p) => ({
      id: `photo-${p.id}`,
      url: p.url,
      caption: p.caption,
      captionTitle: p.caption,
      captionSubtitle: null,
    }));
  const timelineSlides: SlideSource[] = milestones
    .filter((m) => m.imageUrl)
    .map((m) => ({
      id: `timeline-${m.id}`,
      url: m.imageUrl!,
      caption: `${m.period} — ${m.title}`,
      captionTitle: m.title,
      captionSubtitle: m.period,
    }));
  const slides = [...invitationSlide, ...gallerySlides, ...timelineSlides];

  const latestJob = await getLatestCompletedSlideshowVideoJob(event.id);
  const initialVideoUrl = latestJob ? publicMediaUrl("gallery", latestJob.resultPath) : null;

  return (
    <WizardStepShell
      token={token}
      slug="slideshow"
      goals={event.wizardGoals}
      title="Slideshow"
      description={
        shareImageUrl
          ? "Turn your photos into a music-backed slideshow video — your Invitation Card leads it off, followed by Gallery and Timeline photos. Reorder or remove anything below."
          : "Turn your Gallery and Timeline photos into a music-backed slideshow video — pick photos, set the pace, optionally add a song, then render a real MP4."
      }
      headerAction={<SkipStepLink token={token} slug="slideshow" goals={event.wizardGoals} />}
    >
      {slides.length === 0 ? (
        <p className="rounded-lg border border-navy-950/10 bg-white p-5 text-sm text-navy-700/70">
          Add photos on the Gallery or Timeline step first — the slideshow is built from those.
        </p>
      ) : (
        <SlideshowComposer
          eventId={event.id}
          slides={slides}
          quota={null}
          theme={{
            primaryColor: template.primaryColor,
            secondaryColor: template.secondaryColor,
            fontFamily: template.fontFamily,
          }}
          actions={{
            start: draftStartSlideshowVideoAction.bind(null, token),
            requestMusicUpload: draftRequestSlideshowMusicUploadUrlAction.bind(null, token),
            useAsShareVideo: draftConfirmShareVideoUploadAction.bind(null, token),
          }}
          anonAuthKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}
          initialVideoUrl={initialVideoUrl}
        />
      )}
    </WizardStepShell>
  );
}

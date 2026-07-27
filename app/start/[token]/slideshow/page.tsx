import { notFound } from "next/navigation";

import { getDraftEventByToken } from "@/services/event-drafts";
import { getTemplateBySlug } from "@/lib/templates";
import { listGalleryPhotos } from "@/services/gallery-photos";
import { listMilestones } from "@/services/timeline";
import { SlideshowComposer } from "@/features/admin/slideshow/slideshow-composer";
import { WizardStepShell } from "@/features/start/wizard-step-shell";
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

  const gallerySlides: SlideSource[] = photos.map((p) => ({
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
  const slides = [...gallerySlides, ...timelineSlides];

  return (
    <WizardStepShell
      token={token}
      slug="slideshow"
      title="Slideshow"
      description="Turn your Gallery and Timeline photos into a music-backed slideshow video — pick photos, set the pace, optionally add a song, then render a real MP4."
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
        />
      )}
    </WizardStepShell>
  );
}

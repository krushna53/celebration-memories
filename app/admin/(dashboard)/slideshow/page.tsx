import { getCurrentAdmin } from "@/services/admin-auth";
import { resolveAdminEvent } from "@/lib/admin-event";
import { getTemplateBySlug } from "@/lib/templates";
import { listGalleryPhotos } from "@/services/gallery-photos";
import { listMilestones } from "@/services/timeline";
import { countSlideshowVideoGenerations } from "@/services/slideshow-video-generations";
import { SlideshowComposer } from "@/features/admin/slideshow/slideshow-composer";
import type { SlideSource } from "@/types/content";

export const dynamic = "force-dynamic";

// Available to owner and client roles (see lib/admin-roles.ts) — client
// usage is capped per event (events.slideshow_video_generation_limit,
// default 3; owner is exempt) since rendering now runs through
// Shotstack's paid, per-minute-billed API — see the README's "Slideshow
// Video" section for why this moved off free client-side rendering.
export default async function AdminSlideshowPage() {
  const admin = await getCurrentAdmin();
  const event = admin ? await resolveAdminEvent(admin) : null;
  if (!event) {
    return <p className="text-navy-700">No event is assigned to this account yet. Clients: contact the site owner to get linked to your event. Owner: check your Supabase seed data.</p>;
  }

  const template = getTemplateBySlug(event.templateSlug);

  const [photos, milestones] = await Promise.all([
    listGalleryPhotos(event.id),
    listMilestones(event.id),
  ]);

  // Gallery photos and Timeline milestone photos are both selectable as
  // slides — prefixed IDs so the two sources' UUIDs can't collide once
  // merged into one selection list. See types/content.ts's SlideSource.
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

  const isClient = admin?.role === "client";
  const used = isClient ? await countSlideshowVideoGenerations(event.id) : 0;
  const limit = event.slideshowVideoGenerationLimit;

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Slideshow Video</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        Turn your Gallery and Timeline photos into a music-backed slideshow
        video — pick photos, set the pace, optionally add a song and
        timeline captions, then render a real MP4 you can download or use
        as your Link Preview Video.
      </p>
      {isClient ? (
        <p className="mt-1 text-xs text-navy-700/50">
          {Math.max(0, limit - used)} of {limit} renders remaining for this event.
        </p>
      ) : null}
      <div className="mt-6">
        <SlideshowComposer
          eventId={event.id}
          slides={slides}
          quota={isClient ? { used, limit } : null}
          theme={{
            primaryColor: template.primaryColor,
            secondaryColor: template.secondaryColor,
            fontFamily: template.fontFamily,
          }}
        />
      </div>
    </div>
  );
}

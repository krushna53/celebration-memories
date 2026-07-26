import { EVENT_SLUG } from "@/lib/constants";
import { getEventBySlug } from "@/services/events";
import { listGalleryPhotos } from "@/services/gallery-photos";
import { SlideshowComposer } from "@/features/admin/slideshow/slideshow-composer";

export const dynamic = "force-dynamic";

// Available to owner and client roles (see lib/admin-roles.ts) — same
// tier as AI Image and Domain Search. No external API or cost here at
// all: rendering happens entirely client-side via <canvas> +
// MediaRecorder, so there's nothing to configure and no per-use cost.
export default async function AdminSlideshowPage() {
  const event = await getEventBySlug(EVENT_SLUG);
  if (!event) {
    return <p className="text-navy-700">No event found. Check your Supabase seed data.</p>;
  }

  const photos = await listGalleryPhotos(event.id);

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Slideshow Video</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        Turn your Gallery photos into a music-backed slideshow video — pick
        photos, set the pace, optionally add a song, then download the
        result to share anywhere.
      </p>
      <div className="mt-6">
        <SlideshowComposer photos={photos} />
      </div>
    </div>
  );
}

import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/services/admin-auth";
import { resolveAdminEvent } from "@/lib/admin-event";
import { shouldRedirectOrganizerAway, shouldRedirectSessionOrganizerAway } from "@/lib/admin-roles";
import { listMilestones } from "@/services/timeline";
import { listGalleryPhotos } from "@/services/gallery-photos";
import { isHeygenConfigured, listHeygenAvatars, listHeygenVoices } from "@/lib/heygen";
import { countTimelineMovieGenerations } from "@/services/timeline-movie-generations";
import { getLatestCompletedTimelineMovieJob } from "@/services/timeline-movie-jobs";
import { publicMediaUrl } from "@/services/uploads";
import { TimelineMovieComposer } from "@/features/admin/timeline-movie/timeline-movie-composer";

export const dynamic = "force-dynamic";

// Available to owner and client roles (see lib/admin-roles.ts) — client
// usage is capped per event (events.timelineMovieGenerationLimit,
// default 2; owner is exempt) since AI generation runs through HeyGen's
// paid, per-second-billed API. See the README's "AI Timeline Movie"
// section for the full design and current cost estimates.
export default async function AdminTimelineMoviePage() {
  const admin = await getCurrentAdmin();
  if (admin && shouldRedirectSessionOrganizerAway(admin.role)) redirect("/admin/my-sessions");
  if (admin && shouldRedirectOrganizerAway(admin.role)) redirect("/admin/invitees");
  const event = admin ? await resolveAdminEvent(admin) : null;
  if (!event) {
    return (
      <p className="text-navy-700">
        No event is assigned to this account yet. Clients: contact the site owner to get linked to your event.
        Owner: check your Supabase seed data.
      </p>
    );
  }

  const configured = isHeygenConfigured();

  const [milestoneRecords, photos, avatars, voices] = await Promise.all([
    listMilestones(event.id),
    listGalleryPhotos(event.id),
    configured ? listHeygenAvatars() : Promise.resolve([]),
    configured ? listHeygenVoices() : Promise.resolve([]),
  ]);

  const milestones = milestoneRecords.map((m) => ({
    id: m.id,
    period: m.period,
    title: m.title,
    description: m.description ?? "",
    imageUrl: m.imageUrl,
  }));
  const fallbackPhotoUrls = photos.map((p) => p.url);

  const isClient = admin?.role === "client";
  const used = isClient ? await countTimelineMovieGenerations(event.id) : 0;
  const limit = event.timelineMovieGenerationLimit;

  const latestJob = await getLatestCompletedTimelineMovieJob(event.id);
  const initialVideoUrl = latestJob ? publicMediaUrl("videos", latestJob.resultPath) : null;

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">AI Timeline Movie</h1>
      <p className="mt-1 max-w-2xl text-sm text-navy-700/60">
        Turn your Timeline into a narrated highlight video — an AI host reads each selected milestone aloud, with a
        matching photo behind them. Or skip the AI and upload your own pre-made video instead.
      </p>
      {isClient ? (
        <p className="mt-1 text-xs text-navy-700/50">
          {Math.max(0, limit - used)} of {limit} AI render(s) remaining for this event.
        </p>
      ) : null}
      <div className="mt-6">
        <TimelineMovieComposer
          eventId={event.id}
          milestones={milestones}
          fallbackPhotoUrls={fallbackPhotoUrls}
          avatars={avatars}
          voices={voices}
          quota={isClient ? { used, limit } : null}
          initialVideoUrl={initialVideoUrl}
          heygenConfigured={configured}
        />
      </div>
    </div>
  );
}

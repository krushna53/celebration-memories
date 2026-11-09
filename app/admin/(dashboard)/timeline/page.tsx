import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/services/admin-auth";
import { resolveAdminEvent } from "@/lib/admin-event";
import { shouldRedirectSessionOrganizerAway } from "@/lib/admin-roles";
import { listMilestones } from "@/services/timeline";
import { TimelineManager } from "@/features/admin/timeline/timeline-manager";
import { NoEventState } from "@/features/admin/components/no-event-state";
import { GuestContributionsPanel } from "@/features/admin/timeline/guest-contributions-panel";
import { areTimelineContributionsEnabled, listPendingSubmissions } from "@/services/timeline-contributions";
import { SITE_URL } from "@/lib/constants";
import { DisplayMusicPicker } from "@/features/admin/display/display-music-picker";
import { getDisplayMusic } from "@/services/display-music";
import { SimilarPhotosPanel } from "@/features/admin/photo-duplicates/similar-photos-panel";

export const dynamic = "force-dynamic";

export default async function AdminTimelinePage() {
  const admin = await getCurrentAdmin();
  if (admin && shouldRedirectSessionOrganizerAway(admin.role)) redirect("/admin/my-sessions");
  const event = admin ? await resolveAdminEvent(admin) : null;
  if (!event) {
    return <NoEventState />;
  }

  const [milestones, contributionsEnabled, submissions, displayMusic] = await Promise.all([
    listMilestones(event.id),
    areTimelineContributionsEnabled(event.id),
    // A failure here must never take the timeline page down with it.
    listPendingSubmissions(event.id).catch((err) => {
      console.error("listPendingSubmissions failed:", err);
      return [];
    }),
    getDisplayMusic(event.id),
  ]);

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Timeline</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        Add the life milestones shown in the public Timeline section, in order.
      </p>
      <div className="mt-6">
        <GuestContributionsPanel
          eventId={event.id}
          shareUrl={`${SITE_URL}/events/${event.slug}/timeline/share`}
          honoreeName={event.honoreeName}
          enabled={contributionsEnabled}
          submissions={submissions}
          milestones={milestones.map((m) => ({ id: m.id, period: m.period, title: m.title }))}
        />
        <TimelineManager eventId={event.id} initialMilestones={milestones} />
        <div className="mt-8">
          <DisplayMusicPicker
            eventId={event.id}
            initialTracks={displayMusic}
          />
          <p className="mt-2 text-xs text-navy-700/50">
            The Big Screen Display (<a href={`/events/${event.slug}/display`} target="_blank" rel="noopener noreferrer" className="underline">open it</a>)
            shows your Gallery, this Timeline in date order, then guests&rsquo; memories — and starts again from the top, with
            anything new, when it reaches the end.
          </p>
        </div>
        <SimilarPhotosPanel eventId={event.id} />
      </div>
    </div>
  );
}

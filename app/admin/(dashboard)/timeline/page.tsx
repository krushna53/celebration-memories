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

export const dynamic = "force-dynamic";

export default async function AdminTimelinePage() {
  const admin = await getCurrentAdmin();
  if (admin && shouldRedirectSessionOrganizerAway(admin.role)) redirect("/admin/my-sessions");
  const event = admin ? await resolveAdminEvent(admin) : null;
  if (!event) {
    return <NoEventState />;
  }

  const [milestones, contributionsEnabled, submissions] = await Promise.all([
    listMilestones(event.id),
    areTimelineContributionsEnabled(event.id),
    // A failure here must never take the timeline page down with it.
    listPendingSubmissions(event.id).catch((err) => {
      console.error("listPendingSubmissions failed:", err);
      return [];
    }),
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
      </div>
    </div>
  );
}

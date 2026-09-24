import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/services/admin-auth";
import { resolveAdminEvent } from "@/lib/admin-event";
import { shouldRedirectSessionOrganizerAway } from "@/lib/admin-roles";
import { listMilestones } from "@/services/timeline";
import { TimelineManager } from "@/features/admin/timeline/timeline-manager";
import { NoEventState } from "@/features/admin/components/no-event-state";

export const dynamic = "force-dynamic";

export default async function AdminTimelinePage() {
  const admin = await getCurrentAdmin();
  if (admin && shouldRedirectSessionOrganizerAway(admin.role)) redirect("/admin/my-sessions");
  const event = admin ? await resolveAdminEvent(admin) : null;
  if (!event) {
    return <NoEventState />;
  }

  const milestones = await listMilestones(event.id);

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Timeline</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        Add the life milestones shown in the public Timeline section, in order.
      </p>
      <div className="mt-6">
        <TimelineManager eventId={event.id} initialMilestones={milestones} />
      </div>
    </div>
  );
}

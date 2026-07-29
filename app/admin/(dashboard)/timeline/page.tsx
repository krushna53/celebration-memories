import { getCurrentAdmin } from "@/services/admin-auth";
import { resolveAdminEvent } from "@/lib/admin-event";
import { listMilestones } from "@/services/timeline";
import { TimelineManager } from "@/features/admin/timeline/timeline-manager";

export const dynamic = "force-dynamic";

export default async function AdminTimelinePage() {
  const admin = await getCurrentAdmin();
  const event = admin ? await resolveAdminEvent(admin) : null;
  if (!event) {
    return <p className="text-navy-700">No event is assigned to this account yet. Clients: contact the site owner to get linked to your event. Owner: check your Supabase seed data.</p>;
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

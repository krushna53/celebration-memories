import { getCurrentAdmin } from "@/services/admin-auth";
import { resolveAdminEvent } from "@/lib/admin-event";
import { ensurePlannerShareToken, listPlannerTasks, listPlannerNotes } from "@/services/event-planner";
import { PlannerShareLinkPanel } from "@/features/admin/planner/share-link-panel";
import { PlannerAdminClient } from "@/features/admin/planner/planner-admin-client";

export const dynamic = "force-dynamic";

export default async function AdminPlannerPage() {
  const admin = await getCurrentAdmin();
  const event = admin ? await resolveAdminEvent(admin) : null;
  if (!event) {
    return (
      <p className="text-navy-700">
        No event is assigned to this account yet. Clients: contact the site owner to get linked to your event.
      </p>
    );
  }

  const [token, tasks, notes] = await Promise.all([
    ensurePlannerShareToken(event.id),
    listPlannerTasks(event.id),
    listPlannerNotes(event.id),
  ]);

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Planner</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        A shared to-do list and notes board for planning {event.honoreeName}&rsquo;s celebration.
      </p>

      <div className="mt-6">
        <PlannerShareLinkPanel eventId={event.id} token={token} honoreeName={event.honoreeName} />
      </div>

      <div className="mt-6">
        <PlannerAdminClient eventId={event.id} adminName={admin?.name ?? null} tasks={tasks} notes={notes} />
      </div>
    </div>
  );
}

import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/services/admin-auth";
import { resolveAdminEvent } from "@/lib/admin-event";
import { shouldRedirectOrganizerAway, shouldRedirectSessionOrganizerAway } from "@/lib/admin-roles";
import { listSnapshots, getSnapshotCreatorNames, type SnapshotArea } from "@/services/event-snapshots";
import { BackupsManager } from "@/features/admin/backups/backups-manager";
import { NoEventState } from "@/features/admin/components/no-event-state";

export const dynamic = "force-dynamic";

const AREAS: SnapshotArea[] = ["event_settings", "gallery", "timeline", "invitees"];

export default async function BackupsPage() {
  const admin = await getCurrentAdmin();
  if (admin && shouldRedirectSessionOrganizerAway(admin.role)) redirect("/admin/my-sessions");
  if (admin && shouldRedirectOrganizerAway(admin.role)) redirect("/admin/invitees");
  const event = admin ? await resolveAdminEvent(admin) : null;
  if (!event) {
    return <NoEventState />;
  }

  const lists = await Promise.all(AREAS.map((area) => listSnapshots(event.id, area)));
  const snapshotsByArea = Object.fromEntries(AREAS.map((area, i) => [area, lists[i]])) as Record<SnapshotArea, Awaited<ReturnType<typeof listSnapshots>>>;

  const creatorIds = lists.flat().map((s) => s.createdBy).filter((id): id is string => Boolean(id));
  const creatorNames = await getSnapshotCreatorNames(creatorIds);

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Backups</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        A version history for {event.honoreeName}&rsquo;s event — every change to Event Settings, Templates &amp;
        Custom CSS, Gallery, Timeline, and Invitees is saved automatically, so you can always get back to an earlier
        version.
      </p>
      <div className="mt-6">
        <BackupsManager snapshotsByArea={snapshotsByArea} creatorNames={creatorNames} />
      </div>
    </div>
  );
}

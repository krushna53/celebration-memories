import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/services/admin-auth";
import { resolveAdminEvent } from "@/lib/admin-event";
import { shouldRedirectOrganizerAway, shouldRedirectSessionOrganizerAway } from "@/lib/admin-roles";
import { listTrash, TRASH_RETENTION_DAYS } from "@/services/recycle-bin";
import { TrashList } from "@/features/admin/recycle-bin/trash-list";

export const dynamic = "force-dynamic";

export default async function RecycleBinPage() {
  const admin = await getCurrentAdmin();
  if (admin && shouldRedirectSessionOrganizerAway(admin.role)) redirect("/admin/my-sessions");
  if (admin && shouldRedirectOrganizerAway(admin.role)) redirect("/admin/invitees");
  const event = admin ? await resolveAdminEvent(admin) : null;
  if (!event) {
    return <p className="text-navy-700">No event is assigned to this account yet. Clients: contact the site owner to get linked to your event. Owner: check your Supabase seed data.</p>;
  }

  const items = await listTrash(event.id);

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Recycle Bin</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        Deleted Gallery photos and Memory Wall photos/videos/audio stay here for {TRASH_RETENTION_DAYS} days before
        they&rsquo;re permanently removed — restore anything you deleted by mistake, or delete it forever right away.
      </p>

      <TrashList items={items} />
    </div>
  );
}

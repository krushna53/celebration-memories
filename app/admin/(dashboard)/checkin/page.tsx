import { redirect } from "next/navigation";

import { listInvitees } from "@/services/admin-invitees";
import { getCurrentAdmin } from "@/services/admin-auth";
import { resolveAdminEvent } from "@/lib/admin-event";
import { CheckinManager } from "@/features/admin/checkin/checkin-manager";
import { NoEventState } from "@/features/admin/components/no-event-state";

export const dynamic = "force-dynamic";

export default async function AdminCheckinPage() {
  const admin = await getCurrentAdmin();
  // Owner and organizer (#105) only — Check-In has stayed off-limits to
  // a plain "client" admin since it first shipped; organizer is the one
  // new role that gets it, alongside Invitees/Gallery/Timeline. See
  // services/admin-auth.ts's requireAdminForOrganizerArea for the
  // matching Server Action gate on toggleCheckInAction.
  if (admin?.role !== "owner" && admin?.role !== "organizer") redirect("/admin");

  const event = await resolveAdminEvent(admin);
  if (!event) {
    return <NoEventState />;
  }

  const invitees = await listInvitees(event.id);

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Event Day Check-In</h1>
      <p className="mt-1 text-sm text-navy-700/60">Search for a guest and check them in as they arrive.</p>
      <div className="mt-6">
        <CheckinManager initialInvitees={invitees} />
      </div>
    </div>
  );
}

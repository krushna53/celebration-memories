import { redirect } from "next/navigation";

import { listInvitees } from "@/services/admin-invitees";
import { getCurrentAdmin } from "@/services/admin-auth";
import { resolveAdminEvent } from "@/lib/admin-event";
import { CheckinManager } from "@/features/admin/checkin/checkin-manager";
import { NoEventState } from "@/features/admin/components/no-event-state";
import { getEventSegment } from "@/lib/event-segment";
import { clientMayCheckIn } from "@/lib/admin-roles";

export const dynamic = "force-dynamic";

export default async function AdminCheckinPage() {
  const admin = await getCurrentAdmin();
  // Owner and organizer (#105) only — Check-In has stayed off-limits to
  // a plain "client" admin since it first shipped; organizer is the one
  // new role that gets it, alongside Invitees/Gallery/Timeline. See
  // services/admin-auth.ts's requireAdminForOrganizerArea for the
  // matching Server Action gate on toggleCheckInAction.
  // Client hosts also get it on corporate events (see clientMayCheckIn).
  if (!admin) redirect("/admin");
  const event = await resolveAdminEvent(admin);
  const segment = getEventSegment(event?.category);
  if (admin.role !== "owner" && admin.role !== "organizer" && !clientMayCheckIn(admin.role, segment)) redirect("/admin");

  if (!event) {
    return <NoEventState />;
  }
  const corporate = segment === "corporate";

  const invitees = await listInvitees(event.id);

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Event Day Check-In</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        {corporate
          ? "Search for an attendee by name, phone or company and check them in as they arrive."
          : "Search for a guest and check them in as they arrive."}
      </p>
      <div className="mt-6">
        <CheckinManager initialInvitees={invitees} searchPlaceholder={corporate ? "Search name, phone or company..." : undefined} />
      </div>
    </div>
  );
}

import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/services/admin-auth";
import { resolveAdminEvent } from "@/lib/admin-event";
import { shouldRedirectOrganizerAway, shouldRedirectSessionOrganizerAway } from "@/lib/admin-roles";
import { getTeamMembers, TEAM_MEMBER_CAP } from "@/services/admin-team";
import { TeamManager } from "@/features/admin/team/team-manager";
import { NoEventState } from "@/features/admin/components/no-event-state";

export const dynamic = "force-dynamic";

export default async function AdminTeamPage() {
  const admin = await getCurrentAdmin();
  if (admin && shouldRedirectSessionOrganizerAway(admin.role)) redirect("/admin/my-sessions");
  if (admin && shouldRedirectOrganizerAway(admin.role)) redirect("/admin/invitees");
  const event = admin ? await resolveAdminEvent(admin) : null;
  if (!admin || !event) {
    return <NoEventState />;
  }

  const members = await getTeamMembers(event.id);

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Team</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        Give up to {TEAM_MEMBER_CAP} people full dashboard access to {event.honoreeName}&rsquo;s event — a spouse, a
        sibling, anyone helping plan. Send an invite email they complete themselves, or set a password for them
        directly and share it however works best.
      </p>
      <div className="mt-6">
        <TeamManager eventId={event.id} currentAdminId={admin.id} initialMembers={members} />
      </div>
    </div>
  );
}

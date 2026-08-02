import { getCurrentAdmin } from "@/services/admin-auth";
import { resolveAdminEvent } from "@/lib/admin-event";
import { getTeamMembers, TEAM_MEMBER_CAP } from "@/services/admin-team";
import { TeamManager } from "@/features/admin/team/team-manager";

export const dynamic = "force-dynamic";

export default async function AdminTeamPage() {
  const admin = await getCurrentAdmin();
  const event = admin ? await resolveAdminEvent(admin) : null;
  if (!admin || !event) {
    return (
      <p className="text-navy-700">
        No event is assigned to this account yet. Clients: contact the site owner to get linked to your event. Owner:
        check your Supabase seed data.
      </p>
    );
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

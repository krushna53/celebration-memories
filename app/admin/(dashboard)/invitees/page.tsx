import { redirect } from "next/navigation";

import { listInvitees } from "@/services/admin-invitees";
import { getCurrentAdmin } from "@/services/admin-auth";
import { resolveAdminEvent } from "@/lib/admin-event";
import { InviteeManager } from "@/features/admin/invitees/invitee-manager";

export const dynamic = "force-dynamic";

export default async function AdminInviteesPage() {
  const admin = await getCurrentAdmin();
  if (admin?.role !== "owner") redirect("/admin");

  const event = await resolveAdminEvent(admin);
  if (!event) {
    return <p className="text-navy-700">No event is assigned to this account yet. Clients: contact the site owner to get linked to your event. Owner: check your Supabase seed data.</p>;
  }

  const invitees = await listInvitees(event.id);

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Invitees</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        Create invitations, generate unique links, and reach out over WhatsApp.
      </p>
      <div className="mt-6">
        <InviteeManager
          eventId={event.id}
          initialInvitees={invitees}
          hostedBy={event.hostedBy}
          honoreeName={event.honoreeName}
          inviteMessageTemplate={event.inviteMessageTemplate}
        />
      </div>
    </div>
  );
}

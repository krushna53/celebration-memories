import { listInviteesWithRsvp } from "@/services/admin-invitees";
import { getCurrentAdmin } from "@/services/admin-auth";
import { resolveAdminEvent } from "@/lib/admin-event";
import { InviteeManager } from "@/features/admin/invitees/invitee-manager";

export const dynamic = "force-dynamic";

// Available to owner and client roles (see lib/admin-roles.ts) — used to
// be owner-only, but a client host has every reason to see and manage
// their own guest list. Event scoping (so a client only ever sees their
// own invitees, never another client's) comes from resolveAdminEvent,
// same as every other admin page.
export default async function AdminInviteesPage() {
  const admin = await getCurrentAdmin();
  const event = admin ? await resolveAdminEvent(admin) : null;
  if (!event) {
    return <p className="text-navy-700">No event is assigned to this account yet. Clients: contact the site owner to get linked to your event. Owner: check your Supabase seed data.</p>;
  }

  const invitees = await listInviteesWithRsvp(event.id);

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Invitees</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        Create invitations, generate unique links, and reach out over WhatsApp.
      </p>
      <div className="mt-6">
        <InviteeManager
          eventId={event.id}
          eventSlug={event.slug}
          initialInvitees={invitees}
          hostedBy={event.hostedBy}
          honoreeName={event.honoreeName}
          inviteMessageTemplate={event.inviteMessageTemplate}
        />
      </div>
    </div>
  );
}

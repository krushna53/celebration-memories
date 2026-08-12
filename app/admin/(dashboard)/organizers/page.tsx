import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/services/admin-auth";
import { resolveAdminEvent } from "@/lib/admin-event";
import { shouldRedirectSessionOrganizerAway, shouldRedirectOrganizerAway } from "@/lib/admin-roles";
import { listOrganizers } from "@/services/organizers";
import { OrganizerManager } from "@/features/admin/organizers/organizer-manager";

export const dynamic = "force-dynamic";

/**
 * Owner/client-only page for managing #105's "organizer" role — an
 * organizer can't manage other organizers, hence the same
 * shouldRedirectOrganizerAway guard used on every other page organizer
 * shouldn't reach (this page isn't in ORGANIZER_ALLOWED_PATHS either,
 * so nav already hides the link; this closes the direct-navigation
 * gap). session_organizer is redirected too, same as every other page.
 */
export default async function OrganizersPage() {
  const admin = await getCurrentAdmin();
  if (admin && shouldRedirectSessionOrganizerAway(admin.role)) redirect("/admin/my-sessions");
  if (admin && shouldRedirectOrganizerAway(admin.role)) redirect("/admin/invitees");

  const event = admin ? await resolveAdminEvent(admin) : null;
  if (!admin || !event) {
    return (
      <p className="text-navy-700">
        No event is assigned to this account yet. Clients: contact the site owner to get linked to your event.
      </p>
    );
  }

  const organizers = await listOrganizers(event.id);

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Organizers</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        Give someone a dashboard login scoped to Invitees, Gallery, Timeline, and Check-In for {event.honoreeName}
        &rsquo;s event — nothing else, no Event Settings or billing access.
      </p>
      <div className="mt-6">
        <OrganizerManager eventId={event.id} initialOrganizers={organizers} />
      </div>
    </div>
  );
}

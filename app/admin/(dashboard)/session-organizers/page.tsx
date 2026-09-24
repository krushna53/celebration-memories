import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/services/admin-auth";
import { resolveAdminEvent } from "@/lib/admin-event";
import { shouldRedirectOrganizerAway, shouldRedirectSessionOrganizerAway } from "@/lib/admin-roles";
import { listSessionOrganizers } from "@/services/session-organizers";
import { listScheduleItems } from "@/services/event-day";
import { SessionOrganizerManager } from "@/features/admin/session-organizers/session-organizer-manager";
import { NoEventState } from "@/features/admin/components/no-event-state";

export const dynamic = "force-dynamic";

export default async function SessionOrganizersPage() {
  const admin = await getCurrentAdmin();
  if (admin && shouldRedirectSessionOrganizerAway(admin.role)) redirect("/admin/my-sessions");
  if (admin && shouldRedirectOrganizerAway(admin.role)) redirect("/admin/invitees");
  const event = admin ? await resolveAdminEvent(admin) : null;
  if (!admin || !event) {
    return <NoEventState />;
  }

  const [organizers, scheduleItems] = await Promise.all([
    listSessionOrganizers(event.id),
    listScheduleItems(event.id),
  ]);

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Session Organizers</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        Give someone a narrow, view-only dashboard login scoped to one or more Event Day sessions — they can see
        that session&rsquo;s registered attendees and payments, and nothing else about {event.honoreeName}&rsquo;s
        event.
      </p>
      <div className="mt-6">
        <SessionOrganizerManager
          eventId={event.id}
          scheduleItems={[...scheduleItems].sort((a, b) => a.sortOrder - b.sortOrder)}
          initialOrganizers={organizers}
        />
      </div>
    </div>
  );
}

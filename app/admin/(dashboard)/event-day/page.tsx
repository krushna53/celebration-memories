import { getCurrentAdmin } from "@/services/admin-auth";
import { resolveAdminEvent } from "@/lib/admin-event";
import { ensureEventDayShareToken, listMenuItems, listScheduleItems } from "@/services/event-day";
import { EventDayManager } from "@/features/admin/event-day/event-day-manager";

export const dynamic = "force-dynamic";

export default async function AdminEventDayPage() {
  const admin = await getCurrentAdmin();
  const event = admin ? await resolveAdminEvent(admin) : null;
  if (!event) {
    return (
      <p className="text-navy-700">
        No event is assigned to this account yet. Clients: contact the site owner to get linked to your event.
      </p>
    );
  }

  const [scheduleItems, menuItems, shareToken] = await Promise.all([
    listScheduleItems(event.id),
    listMenuItems(event.id),
    event.eventDayMode === "private" ? ensureEventDayShareToken(event.id) : Promise.resolve(event.eventDayShareToken),
  ]);

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Event Day</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        Build a run-of-show schedule and menu for {event.honoreeName}&rsquo;s celebration, and choose whether guests
        see it on the main page or only via a verified link.
      </p>
      <div className="mt-6">
        <EventDayManager
          eventId={event.id}
          initialMode={event.eventDayMode}
          initialMenuStyle={event.menuStyle}
          initialShareToken={shareToken}
          initialScheduleItems={scheduleItems}
          initialMenuItems={menuItems}
        />
      </div>
    </div>
  );
}

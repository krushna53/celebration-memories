import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { getCurrentAdmin } from "@/services/admin-auth";
import { listAllActiveEvents } from "@/services/events";
import { listAdmins } from "@/services/admin-users";
import { EventList } from "@/features/admin/events/event-list";
import { createOwnerEventAction } from "@/features/admin/events/actions";

export const dynamic = "force-dynamic";

/**
 * Owner-only directory of every live client event — the entry point for
 * "go manage any client's site" (see lib/admin-event.ts's
 * resolveAdminEvent and features/admin/events/actions.ts). Clicking
 * Manage on a row scopes the entire rest of the admin dashboard
 * (Overview, Event Settings, Gallery, Templates, AI Image, everything)
 * to that event until the owner exits back here.
 */
export default async function AdminEventsPage() {
  const admin = await getCurrentAdmin();
  if (admin?.role !== "owner") redirect("/admin");

  const [events, admins] = await Promise.all([listAllActiveEvents(), listAdmins()]);

  const membersByEvent = new Map<string, string[]>();
  for (const member of admins) {
    if (member.role !== "client" || !member.resolvedEventId) continue;
    const existing = membersByEvent.get(member.resolvedEventId) ?? [];
    existing.push(member.email);
    membersByEvent.set(member.resolvedEventId, existing);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-navy-950">All Events</h1>
          <p className="mt-1 text-sm text-navy-700/60">
            Every live client event. Manage any of them from here — the rest
            of the dashboard (Event Settings, Gallery, Templates, AI Image,
            and so on) will apply to whichever one you pick until you exit
            back to this list.
          </p>
        </div>
        <form action={createOwnerEventAction}>
          <button
            type="submit"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gold-500 px-4 py-2 text-sm font-medium text-navy-950 hover:brightness-110"
          >
            <Plus size={15} /> New Event
          </button>
        </form>
      </div>

      <div className="mt-6">
        <EventList events={events} membersByEvent={membersByEvent} />
      </div>

      <p className="mt-4 text-xs text-navy-700/50">
        In-progress wizard signups that haven&rsquo;t paid yet live at{" "}
        <code className="rounded bg-navy-950/5 px-1 py-0.5">/admin/drafts</code> instead — this
        list is live events only. Creating a client login for a new event here is a separate step
        (see /admin/register) — this only creates the event itself.
      </p>
    </div>
  );
}

import Link from "next/link";
import { CalendarCheck, Eye, Globe, MonitorPlay, Settings, UserPlus } from "lucide-react";

import { EVENT_CATEGORY_LABELS } from "@/lib/event-category";
import type { EventSummary } from "@/services/events";
import { setActiveAdminEventAction, viewAsClientAction } from "@/features/admin/events/actions";
import { VisibilityToggle } from "@/features/admin/events/visibility-toggle";
import { DeleteEventButton } from "@/features/admin/events/delete-event-button";

/**
 * Owner-only table of every live client event (app/admin/(dashboard)/events)
 * — the "go manage any client's site" entry point. Each row's "Manage"
 * button posts to setActiveAdminEventAction, which sets the
 * cm_admin_active_event cookie and sends the owner into the normal
 * (full, tab-heavy) admin dashboard now scoped to that event (see
 * lib/admin-event.ts). "View as Client" does the same but lands on
 * /admin/simple instead — the exact page that client's own login sends
 * them to. No client-side JS needed for either — plain form posts, same
 * as the sign-out button in the dashboard layout.
 */
interface EventListProps {
  events: EventSummary[];
  /** Client admin email(s) attached to each event, keyed by event id — see app/admin/(dashboard)/events/page.tsx, which builds this from listAdmins(). */
  membersByEvent: Map<string, string[]>;
}

export function EventList({ events, membersByEvent }: EventListProps) {
  if (events.length === 0) {
    return <p className="text-sm text-navy-700/60">No live events yet.</p>;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-navy-950/10 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-navy-950/5 text-xs uppercase tracking-wide text-navy-700/60">
          <tr>
            <th className="px-4 py-3">Event</th>
            <th className="px-4 py-3">Occasion</th>
            <th className="px-4 py-3">Visibility</th>
            <th className="px-4 py-3">Links</th>
            <th className="px-4 py-3">Client</th>
            <th className="px-4 py-3">Created</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-navy-950/5">
          {events.map((event) => {
            const members = membersByEvent.get(event.id) ?? [];
            return (
            <tr key={event.id}>
              <td className="px-4 py-3">
                <div className="font-medium text-navy-950">{event.honoreeName}</div>
                <div className="text-xs text-navy-700/50">{event.eventTitle}</div>
              </td>
              <td className="px-4 py-3 text-navy-700/70">{EVENT_CATEGORY_LABELS[event.category]}</td>
              <td className="px-4 py-3">
                <VisibilityToggle eventId={event.id} visibility={event.visibility} />
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5 text-navy-700/50">
                  <Link
                    href={`/events/${event.slug}`}
                    target="_blank"
                    title="Web Page"
                    aria-label="Open web page"
                    className="hover:text-navy-950"
                  >
                    <Globe size={15} />
                  </Link>
                  <Link
                    href={`/events/${event.slug}/rsvp`}
                    target="_blank"
                    title="RSVP Link"
                    aria-label="Open RSVP link"
                    className="hover:text-navy-950"
                  >
                    <CalendarCheck size={15} />
                  </Link>
                  <Link
                    href={`/events/${event.slug}/display`}
                    target="_blank"
                    title="Big Screen Display"
                    aria-label="Open Big Screen Display"
                    className="hover:text-navy-950"
                  >
                    <MonitorPlay size={15} />
                  </Link>
                </div>
              </td>
              <td className="px-4 py-3 text-navy-700/70">
                {members.length > 0 ? (
                  <div className="flex flex-col gap-0.5">
                    {members.map((email) => (
                      <span key={email} className="text-xs">
                        {email}
                      </span>
                    ))}
                  </div>
                ) : (
                  <Link
                    href={`/admin/register?event=${event.id}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 text-xs text-gold-600 hover:text-gold-700"
                  >
                    <UserPlus size={12} /> Create Login
                  </Link>
                )}
              </td>
              <td className="px-4 py-3 text-navy-700/70">
                {new Date(event.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  <form action={viewAsClientAction.bind(null, event.id)}>
                    <button
                      type="submit"
                      title="See exactly what this client sees — the simplified single-page view"
                      className="inline-flex items-center gap-1 rounded-full border border-navy-950/15 px-3 py-1.5 text-xs font-medium text-navy-700 hover:border-navy-950/30 hover:text-navy-950"
                    >
                      <Eye size={13} /> View as Client
                    </button>
                  </form>
                  <form action={setActiveAdminEventAction.bind(null, event.id)}>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 rounded-full bg-gold-500 px-3 py-1.5 text-xs font-medium text-navy-950 hover:brightness-110"
                    >
                      <Settings size={13} /> Manage
                    </button>
                  </form>
                  <DeleteEventButton
                    eventId={event.id}
                    slug={event.slug}
                    honoreeName={event.honoreeName}
                    eventTitle={event.eventTitle}
                    hasClientLogin={members.length > 0}
                  />
                </div>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

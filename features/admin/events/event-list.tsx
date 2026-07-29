import Link from "next/link";
import { ExternalLink, Settings } from "lucide-react";

import { EVENT_CATEGORY_LABELS } from "@/lib/event-category";
import type { EventSummary } from "@/services/events";
import { setActiveAdminEventAction } from "@/features/admin/events/actions";

/**
 * Owner-only table of every live client event (app/admin/(dashboard)/events)
 * — the "go manage any client's site" entry point. Each row's "Manage"
 * button just posts to setActiveAdminEventAction, which sets the
 * cm_admin_active_event cookie and sends the owner into the normal
 * admin dashboard now scoped to that event (see lib/admin-event.ts).
 * No client-side JS needed — plain form posts, same as the sign-out
 * button in the dashboard layout.
 */
export function EventList({ events }: { events: EventSummary[] }) {
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
            <th className="px-4 py-3">Created</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-navy-950/5">
          {events.map((event) => (
            <tr key={event.id}>
              <td className="px-4 py-3">
                <div className="font-medium text-navy-950">{event.honoreeName}</div>
                <div className="text-xs text-navy-700/50">{event.eventTitle}</div>
              </td>
              <td className="px-4 py-3 text-navy-700/70">{EVENT_CATEGORY_LABELS[event.category]}</td>
              <td className="px-4 py-3 text-navy-700/70">
                {new Date(event.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-3">
                  <Link
                    href={`/events/${event.slug}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 text-xs text-navy-700/60 hover:text-navy-950"
                  >
                    <ExternalLink size={13} /> Preview
                  </Link>
                  <form action={setActiveAdminEventAction.bind(null, event.id)}>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 rounded-full bg-gold-500 px-3 py-1.5 text-xs font-medium text-navy-950 hover:brightness-110"
                    >
                      <Settings size={13} /> Manage
                    </button>
                  </form>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

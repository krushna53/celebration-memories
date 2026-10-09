import { ArrowLeftRight, ChevronDown } from "lucide-react";

import { getEventById } from "@/services/events";
import { switchMyEventAction } from "@/features/admin/events/actions";
import type { CurrentAdmin } from "@/services/admin-auth";

/**
 * Thin "you're currently managing X" strip shown across the admin
 * dashboard while the owner has stepped into a specific client's event
 * (see lib/admin-active-event.ts). Renders nothing for client-role
 * admins (they're always scoped to their own event, nothing to
 * announce) and nothing for the owner when no override is active (the
 * default flagship-event view needs no extra chrome).
 */
export async function ActiveEventBanner({ admin }: { admin: CurrentAdmin }) {
  if (admin.role !== "owner") return <MyEventsSwitcher admin={admin} />;

  return null;
}

/**
 * For a host/organizer who manages more than one event: which one the
 * dashboard is showing, and a menu to switch (switchMyEventAction).
 * Nothing for people with a single event — nothing to choose.
 */
async function MyEventsSwitcher({ admin }: { admin: CurrentAdmin }) {
  if (admin.memberships.length < 2) return null;

  const events = (await Promise.all(admin.memberships.map((m) => getEventById(m.eventId).catch(() => null)))).filter(
    (e): e is NonNullable<typeof e> => Boolean(e),
  );
  const current = events.find((e) => e.id === admin.eventId);
  const others = events.filter((e) => e.id !== admin.eventId);
  if (!current || others.length === 0) return null;

  return (
    <div className="border-b border-gold-500/20 bg-gold-500/10">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs sm:px-6">
        <span className="text-navy-950">
          Managing <strong className="font-medium">{current.honoreeName}</strong>&rsquo;s event
          {current.eventTitle ? <span className="text-navy-700/70"> — {current.eventTitle}</span> : null}
        </span>
        <details className="relative">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-navy-700 underline underline-offset-2 hover:text-navy-950">
            <ArrowLeftRight size={12} /> Switch event <ChevronDown size={12} />
          </summary>
          <div className="absolute right-0 z-40 mt-2 w-72 rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-navy-950/10">
            {others.map((event) => (
              <form key={event.id} action={switchMyEventAction.bind(null, event.id)}>
                <button
                  type="submit"
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm text-navy-950 hover:bg-navy-950/5"
                >
                  <span className="block font-medium">{event.honoreeName}</span>
                  <span className="block text-xs text-navy-700/60">{event.eventTitle}</span>
                </button>
              </form>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}

import { LogOut } from "lucide-react";

import { getActiveEventOverrideId } from "@/lib/admin-active-event";
import { getEventById } from "@/services/events";
import { clearActiveAdminEventAction } from "@/features/admin/events/actions";
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
  if (admin.role !== "owner") return null;

  const overrideId = await getActiveEventOverrideId();
  if (!overrideId) return null;

  const event = await getEventById(overrideId);
  if (!event) return null;

  return (
    <div className="border-b border-gold-500/20 bg-gold-500/10">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs sm:px-6">
        <span className="text-navy-950">
          Managing <strong className="font-medium">{event.honoreeName}</strong>&rsquo;s event —
          everything below applies to this event only.
        </span>
        <form action={clearActiveAdminEventAction}>
          <button
            type="submit"
            className="inline-flex items-center gap-1 text-navy-700 underline underline-offset-2 hover:text-navy-950"
          >
            <LogOut size={12} /> Exit to All Events
          </button>
        </form>
      </div>
    </div>
  );
}

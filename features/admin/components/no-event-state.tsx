import Link from "next/link";
import { CalendarPlus, LayoutList, MessageCircle, Sparkles } from "lucide-react";

import { getCurrentAdmin } from "@/services/admin-auth";
import { createOwnerEventAction } from "@/features/admin/events/actions";

const PRIMARY =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-gold-500 px-6 py-2.5 text-sm font-medium text-navy-950 transition-luxury duration-200 hover:brightness-110";
const SECONDARY =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-navy-950/15 bg-white px-6 py-2.5 text-sm font-medium text-navy-950 transition-luxury duration-200 hover:border-gold-500";

/**
 * Shown by every event-scoped admin page when resolveAdminEvent()
 * (lib/admin-event.ts) returns null. Replaces a bare "No event is
 * assigned to this account yet... check your Supabase seed data"
 * sentence that gave a freshly signed-in user no way forward — it read
 * as an error, not as "here's where to go next."
 *
 * Role-aware: the owner is pointed at All Events (pick one to manage)
 * or creating a new one; a client-role admin with no event is pointed
 * at the self-serve wizard to build theirs, or at Contact if they were
 * expecting to be linked to an existing event.
 */
export async function NoEventState() {
  const admin = await getCurrentAdmin();
  const isOwner = admin?.role === "owner";

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center rounded-2xl border border-navy-950/10 bg-white px-6 py-12 text-center shadow-sm">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gold-500/15 text-gold-600">
        <Sparkles size={24} />
      </span>
      <h1 className="mt-5 font-display text-2xl text-navy-950">
        {isOwner ? "Choose an event to manage" : "Let’s set up your event"}
      </h1>
      <p className="mt-2 max-w-md text-sm text-navy-700/70">
        {isOwner
          ? "Pick any event from All Events to open its dashboard — settings, guests, gallery, and memories — or create a new one."
          : "Your account isn’t linked to an event yet. Create your event in a few minutes, or contact us if someone already set one up for you."}
      </p>
      <div className="mt-8 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
        {isOwner ? (
          <>
            <Link href="/admin/events" className={PRIMARY}>
              <LayoutList size={16} /> Go to All Events
            </Link>
            {/* Same owner-only action as All Events' "New Event" button —
                not /start, which is the client self-serve wizard and
                would try to link the new draft to this admin account. */}
            <form action={createOwnerEventAction}>
              <button type="submit" className={`${SECONDARY} w-full`}>
                <CalendarPlus size={16} /> Create a New Event
              </button>
            </form>
          </>
        ) : (
          <>
            <Link href="/start" className={PRIMARY}>
              <CalendarPlus size={16} /> Create Your Event
            </Link>
            <Link href="/contact" className={SECONDARY}>
              <MessageCircle size={16} /> Contact Us
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireOwner } from "@/services/admin-auth";
import { createOwnerEvent } from "@/services/events";
import { setActiveEventOverrideId, clearActiveEventOverrideId } from "@/lib/admin-active-event";

/**
 * Owner-only — sets which client's event the rest of the admin
 * dashboard should show (see lib/admin-event.ts's resolveAdminEvent),
 * then sends the owner to that event's Overview page. Called from the
 * "Manage" button on /admin/events (features/admin/events/event-list.tsx).
 *
 * The revalidatePath call matters more than it looks: every admin page
 * shares app/admin/(dashboard)/layout.tsx, and Next's client-side
 * Router Cache will happily keep serving an already-visited page (e.g.
 * Event Settings, Timeline) from before the switch when you click to it
 * via a <Link> — the cookie changed on the server, but the browser has
 * no reason to know that on its own. Revalidating the whole /admin
 * layout forces every admin page to refetch fresh on its next visit, so
 * Event Settings/Timeline/Templates/AI Image/etc. actually reflect
 * whichever event you just switched to instead of showing stale data
 * from whatever you were looking at before.
 */
export async function setActiveAdminEventAction(eventId: string): Promise<void> {
  await requireOwner();
  await setActiveEventOverrideId(eventId);
  revalidatePath("/admin", "layout");
  redirect("/admin");
}

/** Owner-only — stops managing a specific client's event, back to the owner's own default (flagship) event. See setActiveAdminEventAction's comment for why revalidatePath is needed here too. */
export async function clearActiveAdminEventAction(): Promise<void> {
  await requireOwner();
  await clearActiveEventOverrideId();
  revalidatePath("/admin", "layout");
  redirect("/admin/events");
}

/**
 * Owner-only — creates a brand-new, empty event (see
 * services/events.ts's createOwnerEvent) for a client the owner is
 * onboarding directly, and immediately switches the dashboard to manage
 * it, landing on Event Settings so real details can be filled in right
 * away.
 */
export async function createOwnerEventAction(): Promise<void> {
  await requireOwner();
  const event = await createOwnerEvent();
  await setActiveEventOverrideId(event.id);
  revalidatePath("/admin", "layout");
  redirect("/admin/event-settings");
}

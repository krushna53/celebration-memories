"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireOwner, requireAdminForEvent } from "@/services/admin-auth";
import { createOwnerEvent, updateEvent, getEventById } from "@/services/events";
import { deleteEventAndAllAssets } from "@/services/admin-danger-zone";
import {
  setActiveEventOverrideId,
  clearActiveEventOverrideId,
  getActiveEventOverrideId,
} from "@/lib/admin-active-event";

export type ToggleVisibilityResult = { success: true; visibility: "public" | "private" } | { success: false; error: string };

/**
 * One-click public/private flip — the same events.visibility field the
 * full Event Settings form already edits (features/admin/event-settings/
 * event-settings-form.tsx), but without opening that form or saving the
 * rest of it. Used by both the owner's All Events list
 * (features/admin/events/event-list.tsx) and the client's /admin/simple
 * card, via requireAdminForEvent so an owner can flip any event and a
 * client only their own (never trusts a client-supplied "next" value
 * without that check).
 */
export async function toggleEventVisibilityAction(
  eventId: string,
  next: "public" | "private",
): Promise<ToggleVisibilityResult> {
  try {
    await requireAdminForEvent(eventId);
    await updateEvent(eventId, { visibility: next });
    revalidatePath("/admin/events");
    revalidatePath("/admin/simple");
    revalidatePath("/admin/event-settings");
    revalidatePath("/events");
    return { success: true, visibility: next };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

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

/**
 * Same "step into a client's event" mechanism as setActiveAdminEventAction
 * above, but lands the owner on /admin/simple — the exact page that
 * client's own login sends them to (see the ?from=login redirect in
 * app/admin/(dashboard)/page.tsx) — instead of the full tab-heavy
 * dashboard. Lets the owner see precisely what that client sees, e.g.
 * for support/troubleshooting, without needing that client's own
 * credentials. ActiveEventBanner (rendered on /admin/simple too) shows
 * "Managing X — Exit" the whole time this is active.
 */
export async function viewAsClientAction(eventId: string): Promise<void> {
  await requireOwner();
  await setActiveEventOverrideId(eventId);
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/simple");
  redirect("/admin/simple");
}

/** Owner-only — stops managing a specific client's event, back to the owner's own default (flagship) event. See setActiveAdminEventAction's comment for why revalidatePath is needed here too. */
export async function clearActiveAdminEventAction(): Promise<void> {
  await requireOwner();
  await clearActiveEventOverrideId();
  revalidatePath("/admin", "layout");
  redirect("/admin/events");
}

export type DeleteEventResult = { success: true } | { success: false; error: string };

/**
 * Owner-only — permanently deletes an event and everything in it
 * (photos, videos, audio, guestbook, invitees, RSVPs, timeline, any
 * client login pointed at it — see deleteEventAndAllAssets's doc
 * comment for the full list). Requires the caller to pass back the
 * event's own slug as confirmation, checked server-side against the
 * real value rather than trusting whatever the client claims was
 * typed — same pattern as deleteAdminAccountAction
 * (features/admin/members/actions.ts), just keyed by slug instead of
 * email since an event doesn't always have a client login attached
 * (see the "Create Login" rows on /admin/events) and honoreeName isn't
 * guaranteed unique across events.
 *
 * Note: if this event does have a client login, deleting it here
 * removes that login's `admins` row (cascades with the event) so it
 * stops working immediately, but the underlying Supabase Auth account
 * isn't removed — that email can't be reused via "Create Login" until
 * it's also deleted from Members > Delete Permanently.
 */
export async function deleteEventAction(eventId: string, confirmSlug: string): Promise<DeleteEventResult> {
  await requireOwner();

  try {
    const event = await getEventById(eventId);
    if (!event) {
      return { success: false, error: "Event not found — it may already be deleted." };
    }
    if (event.slug.trim().toLowerCase() !== confirmSlug.trim().toLowerCase()) {
      return { success: false, error: "That doesn't match — nothing was deleted." };
    }

    await deleteEventAndAllAssets(eventId);

    // If the owner just deleted whichever event they were actively
    // "managing" via Manage/View as Client, clear that pointer so the
    // next admin page load doesn't try to resolve a now-nonexistent
    // event (see lib/admin-event.ts's resolveAdminEvent).
    const activeId = await getActiveEventOverrideId();
    if (activeId === eventId) {
      await clearActiveEventOverrideId();
    }

    revalidatePath("/admin/events");
    revalidatePath("/admin", "layout");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to delete event." };
  }
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

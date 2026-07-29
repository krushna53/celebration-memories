"use server";

import { redirect } from "next/navigation";

import { requireOwner } from "@/services/admin-auth";
import { createOwnerEvent } from "@/services/events";
import { setActiveEventOverrideId, clearActiveEventOverrideId } from "@/lib/admin-active-event";

/**
 * Owner-only — sets which client's event the rest of the admin
 * dashboard should show (see lib/admin-event.ts's resolveAdminEvent),
 * then sends the owner to that event's Overview page. Called from the
 * "Manage" button on /admin/events (features/admin/events/event-list.tsx).
 */
export async function setActiveAdminEventAction(eventId: string): Promise<void> {
  await requireOwner();
  await setActiveEventOverrideId(eventId);
  redirect("/admin");
}

/** Owner-only — stops managing a specific client's event, back to the owner's own default (flagship) event. */
export async function clearActiveAdminEventAction(): Promise<void> {
  await requireOwner();
  await clearActiveEventOverrideId();
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
  redirect("/admin/event-settings");
}

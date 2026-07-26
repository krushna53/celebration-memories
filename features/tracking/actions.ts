"use server";

import { logPageView, logRsvpStarted, type PageViewType, type RsvpFormSource } from "@/services/tracking";

/**
 * Public, unauthenticated tracking actions — called from anonymous
 * visitors' browsers (PageViewBeacon, RsvpForm/PublicRsvpForm onFocus),
 * so there's deliberately no auth check here, only an eventId being a
 * real UUID. Failures are swallowed by the caller; a tracking hiccup
 * should never be visible to a guest.
 */
export async function logPageViewAction(eventId: string, page: PageViewType): Promise<void> {
  await logPageView(eventId, page);
}

export async function logRsvpStartedAction(eventId: string, source: RsvpFormSource): Promise<void> {
  await logRsvpStarted(eventId, source);
}

import "server-only";

import { getDraftEventByToken } from "@/services/event-drafts";
import type { EventRecord } from "@/types/event";

/**
 * The auth check every draft-scoped Server Action uses instead of
 * getCurrentAdmin() — see services/event-drafts.ts for why possession
 * of the URL token is the credential here, same as a guest invite link.
 * Draft actions take `token` as their own explicit first parameter, then
 * get `.bind(null, token)`'d in the wizard's Server Component page
 * before being handed to a Client Component as a prop — see the
 * "actions" prop pattern in features/admin/timeline/timeline-manager.tsx
 * and its siblings. Never trust a client-supplied eventId beyond what
 * the token itself resolves to.
 */
export async function requireDraftEvent(token: string): Promise<EventRecord> {
  const event = await getDraftEventByToken(token);
  if (!event) {
    throw new Error(
      "This link is invalid, or the event has already been set up — sign in to the dashboard instead.",
    );
  }
  return event;
}

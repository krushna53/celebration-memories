"use server";

import { getScheduleItemByShareToken, findInviteeByPhoneForEventDay } from "@/services/event-day";
import { getEventById } from "@/services/events";
import { getFormById } from "@/services/custom-forms";
import { listRegisteredScheduleItemIds } from "@/services/session-registrations";
import type { ScheduleItemRecord } from "@/types/content";

export type SessionShareVerifyResult =
  | {
      success: true;
      data: {
        eventId: string;
        inviteeId: string;
        honoreeName: string;
        eventTitle: string;
        session: ScheduleItemRecord;
        alreadyRegistered: boolean;
        /** Public fill-page slug for the linked Custom Form Builder form (#106), if the host attached one — "extra questions" beyond name/phone. Null when none attached. */
        customFormSlug: string | null;
      };
    }
  | { success: false; error: string };

/**
 * Public, share-token-scoped action backing /session/[token] (#106) —
 * the per-session sibling of features/event-day/actions.ts's
 * verifyEventDayAccessAction, scoped to ONE schedule item instead of an
 * event's whole schedule/menu. Same phone-verification gate (a guest
 * must already be on this event's invitee list — this never creates a
 * new invitee), so a session organizer sharing this link still can't
 * register someone who isn't an actual guest.
 */
export async function verifySessionShareAccessAction(
  token: string,
  name: string,
  phone: string,
): Promise<SessionShareVerifyResult> {
  try {
    const session = await getScheduleItemByShareToken(token);
    if (!session) return { success: false, error: "This link isn't active anymore." };
    if (!name.trim()) return { success: false, error: "Please enter your name." };

    const event = await getEventById(session.eventId);
    if (!event) return { success: false, error: "This link isn't active anymore." };

    const invitee = await findInviteeByPhoneForEventDay(session.eventId, phone);
    if (!invitee) {
      return {
        success: false,
        error: "We couldn't find that phone number on the guest list — please check it and try again.",
      };
    }

    const [registeredIds, customForm] = await Promise.all([
      listRegisteredScheduleItemIds(invitee.id),
      session.customFormId ? getFormById(session.customFormId) : Promise.resolve(null),
    ]);

    return {
      success: true,
      data: {
        eventId: session.eventId,
        inviteeId: invitee.id,
        honoreeName: event.honoreeName,
        eventTitle: event.eventTitle,
        session,
        alreadyRegistered: registeredIds.includes(session.id),
        customFormSlug: customForm?.slug ?? null,
      },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Something went wrong — please try again." };
  }
}

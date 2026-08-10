"use server";

import {
  getEventByEventDayToken,
  listMenuItems,
  listScheduleItems,
  findInviteeByPhoneForEventDay,
} from "@/services/event-day";
import { listRegisteredScheduleItemIds } from "@/services/session-registrations";
import type { MenuItemRecord, MenuStyle, ScheduleItemRecord } from "@/types/content";

export type EventDayVerifyResult =
  | {
      success: true;
      data: {
        eventId: string;
        inviteeId: string;
        honoreeName: string;
        eventTitle: string;
        menuStyle: MenuStyle;
        scheduleItems: ScheduleItemRecord[];
        menuItems: MenuItemRecord[];
        /** Schedule item ids this guest is already registered for — used to render "Registered" instead of a Register button. */
        registeredScheduleItemIds: string[];
      };
    }
  | { success: false; error: string };

/**
 * Public, token-scoped action backing /event-day/[token] (private mode
 * only). Verifies the guest by phone against this event's invitee list
 * — same real check Games already does — and only then returns the
 * schedule/menu plus the guest's own invitee id (needed for #63's
 * per-session registration), in one round trip. The anonymous public
 * homepage embed never calls this action, so it never gets an identity
 * — Register controls there are intentionally not offered.
 */
export async function verifyEventDayAccessAction(
  token: string,
  name: string,
  phone: string,
): Promise<EventDayVerifyResult> {
  try {
    const event = await getEventByEventDayToken(token);
    if (!event) return { success: false, error: "This link isn't active anymore." };
    if (!name.trim()) return { success: false, error: "Please enter your name." };

    const invitee = await findInviteeByPhoneForEventDay(event.id, phone);
    if (!invitee) {
      return {
        success: false,
        error: "We couldn't find that phone number on the guest list — please check it and try again.",
      };
    }

    const [scheduleItems, menuItems, registeredScheduleItemIds] = await Promise.all([
      listScheduleItems(event.id),
      listMenuItems(event.id),
      listRegisteredScheduleItemIds(invitee.id),
    ]);

    return {
      success: true,
      data: {
        eventId: event.id,
        inviteeId: invitee.id,
        honoreeName: event.honoreeName,
        eventTitle: event.eventTitle,
        menuStyle: event.menuStyle,
        scheduleItems,
        menuItems,
        registeredScheduleItemIds,
      },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Something went wrong — please try again." };
  }
}

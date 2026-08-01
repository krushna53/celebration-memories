"use server";

import {
  getEventByEventDayToken,
  listMenuItems,
  listScheduleItems,
  verifyInviteeByPhone,
} from "@/services/event-day";
import type { MenuItemRecord, MenuStyle, ScheduleItemRecord } from "@/types/content";

export type EventDayVerifyResult =
  | {
      success: true;
      data: {
        honoreeName: string;
        eventTitle: string;
        menuStyle: MenuStyle;
        scheduleItems: ScheduleItemRecord[];
        menuItems: MenuItemRecord[];
      };
    }
  | { success: false; error: string };

/**
 * Public, token-scoped action backing /event-day/[token] (private mode
 * only). Verifies the guest by phone against this event's invitee list
 * — same real check Games already does (see verifyInviteeByPhone's doc
 * comment) — and only then returns the schedule/menu, in one round trip.
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

    const verified = await verifyInviteeByPhone(event.id, phone);
    if (!verified) {
      return {
        success: false,
        error: "We couldn't find that phone number on the guest list — please check it and try again.",
      };
    }

    const [scheduleItems, menuItems] = await Promise.all([
      listScheduleItems(event.id),
      listMenuItems(event.id),
    ]);

    return {
      success: true,
      data: {
        honoreeName: event.honoreeName,
        eventTitle: event.eventTitle,
        menuStyle: event.menuStyle,
        scheduleItems,
        menuItems,
      },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Something went wrong — please try again." };
  }
}
